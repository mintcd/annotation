// ─── Framed Page Proxy ───────────────────────────────────────────────────────
//
// Serves a fully-rewritten HTML page so it can be loaded inside a same-origin
// <iframe>. All resource URLs are rewritten to /_proxy/{slug}/… so assets load
// correctly. Scripts execute natively in the iframe's own window — no manual
// injection or ordering needed.
//
// Because the iframe shares our origin, the parent app has full
// iframe.contentDocument access for highlight injection and range matching.

import * as cheerio from 'cheerio';
import { getEnv } from '../../../../utils/env';

const BLOCKED_SCRIPT_HOSTS = [
  'googletagmanager.com', 'google-analytics.com', 'analytics.google.com',
  'hotjar.com', 'static.hotjar.com', 'script.hotjar.com',
  'doubleclick.net', 'googlesyndication.com', 'adservice.google.com',
  'connect.facebook.net', 'sc-static.net',
  'cdn.cookielaw.org', 'cdn.onetrust.com', 'onetrust.com',
  'cookiebot.com', 'usercentrics.eu', 'trustarc.com',
];

function isBlocked(src: string): boolean {
  try {
    const h = new URL(src).hostname;
    return BLOCKED_SCRIPT_HOSTS.some(d => h === d || h.endsWith('.' + d));
  } catch { return false; }
}

function absoluteUrl(base: string, relative: string): string {
  if (!relative || /^(data:|blob:|mailto:|tel:|javascript:)/i.test(relative)) return relative;
  try { return new URL(relative, base).href; } catch { return relative; }
}

function proxiedUrl(slug: string, absolute: string): string {
  try {
    const u = new URL(absolute);
    return `/_proxy/${slug}${u.pathname}${u.search}${u.hash}`;
  } catch { return absolute; }
}

// Tiny script injected at top of <head> inside the iframe.
// • Rewrites runtime root-relative URLs → /_proxy/{slug}/…
function contentScript(slug: string): string {
  return (
    `<script data-proxy-injected="1">(function(){
  // ── Root-relative URL interceptor ──────────────────────────────────────
  var slug=${JSON.stringify(slug)};
  var base='/_proxy/'+slug;
  function rw(u){
    if(!u||typeof u!=='string')return u;
    if(u.startsWith('/')&&!u.startsWith('//')&&!u.startsWith('/_proxy/')&&!u.startsWith('/_next/')&&!u.startsWith('/api/'))
      return base+u;
    return u;
  }
  var BLOCKED=${JSON.stringify(BLOCKED_SCRIPT_HOSTS)};
  function isBlocked(u){try{var h=new URL(u).hostname;return BLOCKED.some(function(d){return h===d||h.endsWith('.'+d);});}catch(e){return false;}}
  var sDesc=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
  if(sDesc&&sDesc.set){
    Object.defineProperty(HTMLScriptElement.prototype,'src',{get:sDesc.get,set:function(v){
      if(typeof v==='string'&&isBlocked(v)){this.type='javascript/blocked';return;}
      sDesc.set.call(this,rw(v));
    },configurable:true});
  }
  var lDesc=Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype,'href');
  if(lDesc&&lDesc.set)Object.defineProperty(HTMLLinkElement.prototype,'href',{get:lDesc.get,set:function(v){lDesc.set.call(this,rw(v));},configurable:true});
  var iDesc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
  if(iDesc&&iDesc.set)Object.defineProperty(HTMLImageElement.prototype,'src',{get:iDesc.get,set:function(v){iDesc.set.call(this,rw(v));},configurable:true});
  var origSetAttr=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(n,v){
    if(n==='src'&&typeof v==='string'){if(isBlocked(v)){this.type='javascript/blocked';return;}return origSetAttr.call(this,n,rw(v));}
    if(n==='href'&&typeof v==='string')return origSetAttr.call(this,n,rw(v));
    return origSetAttr.call(this,n,v);
  };
  var origFetch=window.fetch;
  window.fetch=function(input,init){
    if(typeof input==='string')input=rw(input);
    else if(input&&typeof input==='object'&&input.url){var u=rw(input.url);if(u!==input.url)input=new Request(u,input);}
    return origFetch.call(this,input,init);
  };
  var origOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url){
    if(typeof url==='string')url=rw(url);
    return origOpen.apply(this,[method,url].concat(Array.prototype.slice.call(arguments,2)));
  };
})();
window.addEventListener('error', function(e) {
  window.parent.postMessage({ type: 'proxy:error', message: e.message, filename: e.filename, lineno: e.lineno }, '*');
});
window.addEventListener('unhandledrejection', function(e) {
  window.parent.postMessage({ type: 'proxy:error', message: String(e.reason) }, '*');
});
</script>`
  );
}

export async function GET(
  request: Request,
  { params }: { params: { site: string; path?: string[] } }
) {
  const { site, path } = params;
  const reqUrl = new URL(request.url);

  // ── 1. Resolve origin ──────────────────────────────────────────────────
  let siteOrigin: string;
  try {
    const env = getEnv();
    const row = await env.DB.prepare('SELECT origin FROM websites WHERE id = ?')
      .bind(site).first<{ origin: string }>();
    if (!row) return new Response(`Unknown site: ${site}`, { status: 404 });
    siteOrigin = row.origin;
  } catch {
    return new Response('Database unavailable', { status: 503 });
  }

  // ── 2. Fetch upstream HTML ─────────────────────────────────────────────
  const pathname = path?.length ? '/' + path.join('/') : '/';
  const targetUrl = `${siteOrigin}${pathname}${reqUrl.search}`;

  let html: string;
  let finalUrl: string;
  try {
    const res = await fetch(targetUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    if (!res.ok) return new Response(`Upstream ${res.status}`, { status: 502 });
    const ct = res.headers.get('Content-Type') || '';
    if (!ct.includes('text/html')) return new Response('Not an HTML page', { status: 415 });
    html = await res.text();
    finalUrl = res.url;
  } catch (e) {
    return new Response(`Fetch error: ${e}`, { status: 502 });
  }

  // ── 3. Rewrite URLs ────────────────────────────────────────────────────
  const pageUrl = new URL(finalUrl);
  const baseTagHref = (() => {
    const m = html.match(/<base[^>]+href=["']([^"']+)["']/i);
    return m ? m[1] : null;
  })();
  const base = (baseTagHref ? new URL(baseTagHref, pageUrl) : new URL('.', pageUrl)).href;

  const $ = cheerio.load(html);

  // Remove CSP meta tags so the page can load proxied resources
  $('meta[http-equiv="Content-Security-Policy"]').remove();
  $('meta[http-equiv="X-Frame-Options"]').remove();

  // Remove resource hints (React 19 hoists <link> elements from iframes too)
  $('link[rel~="preload"], link[rel~="prefetch"], link[rel~="modulepreload"], link[rel~="preconnect"], link[rel~="dns-prefetch"]').remove();

  // Remove blocked third-party scripts
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (isBlocked(absoluteUrl(base, src))) $(el).remove();
  });

  // Rewrite src / href / srcset / action on all elements
  $('[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (!src || /^(data:|blob:|javascript:)/i.test(src)) return;
    const abs = absoluteUrl(base, src);
    $(el).attr('src', proxiedUrl(site, abs));
  });

  $('[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    const rel = $(el).attr('rel') || '';
    // Stylesheet hrefs → proxy if same-origin, leave absolute if external CDN
    // (external font CDNs like fonts.googleapis.com have CORS headers; proxying
    // them strips their hostname and causes a 404, breaking web fonts).
    if (rel.includes('stylesheet') || el.tagName === 'link') {
      const abs = absoluteUrl(base, href);
      const isSameOrigin = (() => { try { return new URL(abs).origin === pageUrl.origin; } catch { return false; } })();
      $(el).attr('href', isSameOrigin ? proxiedUrl(site, abs) : abs);
    }
    // <a href> — rewrite to absolute so relative links don't 404 in our origin,
    // but don't proxy them (navigation is handled by the parent app).
    else if (el.tagName === 'a') {
      $(el).attr('href', absoluteUrl(base, href));
    }
  });

  // srcset
  $('[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    const rewritten = srcset.split(',').map(part => {
      const [u, d] = part.trim().split(/\s+/, 2);
      if (!u || /^(data:|blob:)/i.test(u)) return part;
      const proxied = proxiedUrl(site, absoluteUrl(base, u));
      return d ? `${proxied} ${d}` : proxied;
    }).join(', ');
    $(el).attr('srcset', rewritten);
  });

  // Inline style url() references
  $('[style]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const rewritten = style.replace(/url\(['"]?([^'")]+)['"]?\)/g, (_m, u) => {
      if (/^(data:|blob:)/i.test(u)) return _m;
      return `url(${proxiedUrl(site, absoluteUrl(base, u))})`;
    });
    $(el).attr('style', rewritten);
  });

  // ── 4. Inject content script as first child of <head> ─────────────────
  $('head').prepend(contentScript(site));

  // ── 5. Return ─────────────────────────────────────────────────────────
  const rewritten = $.html();
  return new Response(rewritten, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // Allow framing from our own origin
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
