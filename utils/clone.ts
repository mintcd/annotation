/* eslint-disable @typescript-eslint/no-explicit-any */
import { cache } from 'react';
import * as cheerio from 'cheerio';
import * as css from 'css';

export type ScriptItem = { src?: string; content?: string; type?: string; async?: boolean; defer?: boolean };
export type ClonedPage = {
  title: string;
  favicon?: string;
  body: string;
  scripts: ScriptItem[];
};

function isSkippable(u: string) {
  return /^data:|^blob:|^mailto:|^tel:|^javascript:/i.test(u || "");
}

function absoluteUrl(base: string, relative: string): string {
  if (!relative) return '';
  if (/^data:|^blob:|^mailto:|^tel:|^javascript:/i.test(relative)) return relative;
  try {
    return new URL(relative, base).href;
  } catch (e) {
    try {
      const dir = new URL('.', base).href;
      return new URL(relative, dir).href;
    } catch (err) {
      return relative;
    }
  }
}

function proxiedUrl(apiBase: string, targetUrl: string): string {
  try {
    const u = new URL(targetUrl);
    const base = apiBase.endsWith('/') ? apiBase.slice(0, -1) : apiBase;
    const proto = (u.protocol === 'http:' || u.protocol === 'https:') ? u.protocol.replace(':', '') + '/' : '';
    return `${base}/proxy/${proto}${u.host}${u.pathname}${u.search}${u.hash}`;
  } catch (e) {
    return targetUrl;
  }
}

function injectSignalSnippet(text: string, url: string): string {
  const signalSnippet = `\n\n;// Proxy execution signal - do not remove\n(function(){try{var d=${JSON.stringify({ url })};if(typeof window!=='undefined'){window.__proxy_script_executed=window.__proxy_script_executed||[];window.__proxy_script_executed.push(d.url);if(typeof window.__proxy_script_executed_dispatch!=='function'){window.__proxy_script_executed_dispatch=function(detail){try{var ev;try{ev=new CustomEvent('proxy:script-executed',{detail:detail});}catch(e){ev=document.createEvent('CustomEvent');ev.initCustomEvent('proxy:script-executed',false,false,detail);}if(typeof window!=='undefined'&&window.dispatchEvent){window.dispatchEvent(ev);} }catch(e){if(typeof console!=='undefined'&&console.warn)console.warn('proxy dispatch error',e);}}}try{window.__proxy_script_executed_dispatch(d);}catch(e){} } }catch(err){if(typeof console!=='undefined'&&console.warn)console.warn('proxy signal error',err);} })();\n`;
  return `${text}\n${signalSnippet}`;
}

function rewriteCss(cssText: string, cssUrl: string, apiBase: string) {
  const cssUrlObj = new URL(cssUrl);

  cssText = cssText.replace(/url\((['"]?)([^'"\)]+)\1\)/g, (match, quote, url) => {
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return match;
    const resolvedUrl = new URL(url, cssUrl);
    const rewrittenUrl = proxiedUrl(apiBase, resolvedUrl.href);
    return `url(${quote}${rewrittenUrl}${quote})`;
  });

  cssText = cssText.replace(/@import\s+url\((['"]?)([^'"\)]+)\1\)/g, (match, quote, url) => {
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return match;
    try {
      const resolvedUrl = new URL(url, cssUrl);
      const rewrittenUrl = proxiedUrl(apiBase, resolvedUrl.href);
      return `@import url(${quote}${rewrittenUrl}${quote})`;
    } catch {
      const proxyBase = `/proxy/${cssUrlObj.host}`;
      const fullUrl = url.startsWith('/') ? `${proxyBase}${url}` : `${proxyBase}/${url}`;
      return `@import url(${quote}${fullUrl}${quote})`;
    }
  });

  cssText = cssText.replace(/@import\s+(['"])([^'";\)]+)\1\s*;/g, (match, quote, url) => {
    if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:')) return match;
    try {
      const resolvedUrl = new URL(url, cssUrl);
      const rewrittenUrl = proxiedUrl(apiBase, resolvedUrl.href);
      return `@import url(${quote}${rewrittenUrl}${quote})`;
    } catch {
      const cssUrlObj = new URL(cssUrl);
      const proxyBase = `/proxy/${cssUrlObj.host}`;
      const fullUrl = url.startsWith('/') ? `${proxyBase}${url}` : `${proxyBase}/${url}`;
      return `@import url(${quote}${fullUrl}${quote})`;
    }
  });

  return cssText;
}

export const getClonedPage = cache(async (apiBase: string, url: string): Promise<ClonedPage> => {
  if (!url) throw new Error('Missing URL');

  const fetchHeaders: Record<string, string> = {
    'User-Agent': 'Chrome/120.0.0.0',
    'Content-Type': 'text/html',
  };

  const res = await fetch(url, { redirect: 'follow', headers: fetchHeaders });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);
  const pageUrl = new URL(res.url);
  const baseTagHref = $('base[href]').attr('href');
  const clonedBase = (baseTagHref ? new URL(baseTagHref, pageUrl) : new URL('.', pageUrl)).href;

  // Remove cookie/consent banners
  $('[class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], [class*="gdpr"], [id*="gdpr"]').remove();

  // Rewrite anchors
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    if (/^(#|mailto:|tel:|javascript:)/i.test(href)) return;
    $(el).attr('href', absoluteUrl(clonedBase, href));
  });

  // Images
  $('img[src]').each((_, el) => {
    const src = $(el).attr('src') as string;
    $(el).attr('src', absoluteUrl(clonedBase, src));
  });

  // srcset
  $('img[srcset], source[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset');
    if (!srcset) return;
    const rewritten = srcset
      .split(',')
      .map(part => {
        const [u, d] = part.trim().split(/\s+/, 2);
        if (!u || isSkippable(u)) return part;
        const abs = absoluteUrl(clonedBase, u);
        return d ? `${abs} ${d}` : abs;
      })
      .join(', ');
    $(el).attr('srcset', rewritten);
  });

  // Extract scripts and remove originals
  const scripts: ScriptItem[] = [];
  $('script').each((_, el) => {
    const script = $(el);
    const src = script.attr('src');
    const content = (script.text() || '').trim();
    const type = script.attr('type') || undefined;
    const async = script.attr('async') !== undefined;
    const defer = script.attr('defer') !== undefined;

    if (src) {
      const abs = absoluteUrl(clonedBase, src);
      scripts.push({ src: proxiedUrl(apiBase, abs), type, async, defer });
    } else if (content) {
      let rewrittenContent = content;
      rewrittenContent = rewrittenContent.replace(/(?:["']?)src(?:["']?)\s*:\s*("|')(.*?)\1/g, (m: any, q: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return `src: ${q}${proxiedUrl(apiBase, absoluteUrl(clonedBase, u))}${q}`;
      });
      rewrittenContent = rewrittenContent.replace(/\.src\s*=\s*("|')(.*?)\1/g, (m: any, q: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return m.replace(u, proxiedUrl(apiBase, absoluteUrl(clonedBase, u)));
      });
      rewrittenContent = rewrittenContent.replace(/setAttribute\(\s*("|')src\1\s*,\s*("|')(.*?)\2\s*\)/g, (m: any, _q1: any, q2: any, u: any) => {
        if (!u || u.startsWith('http') || u.startsWith('//') || isSkippable(u) || u.includes('/proxy/')) return m;
        return m.replace(u, proxiedUrl(apiBase, absoluteUrl(clonedBase, u)));
      });
      rewrittenContent = rewrittenContent.replace(/(\w+)\s*:\s*['"](\/[^'\"]*)['"]/g, (m: any, prop: any, u: any) => {
        if (prop === 'src' && !u.startsWith('http') && !u.startsWith('//') && !isSkippable(u) && !u.includes('/proxy/')) {
          return `${prop}: '${proxiedUrl(apiBase, absoluteUrl(clonedBase, u))}'`;
        }
        return m;
      });

      const finalContent = injectSignalSnippet(rewrittenContent, url);
      scripts.push({ content: finalContent, type, async, defer });
    }
  }).remove();

  // Rewrite and hoist styles
  const headStyles: string[] = [];
  $('head style').each((_: any, el: any) => {
    let styleContent = $(el).html() || '';
    styleContent = styleContent.replace(/font-family\s*:\s*([^;]+);/gi, 'font-family: $1 !important;');
    try {
      const parsed = css.parse(styleContent);
      if (parsed.stylesheet) {
        parsed.stylesheet.rules.forEach((rule: any) => {
          if (rule.type === 'rule' && rule.selectors) {
            rule.selectors = rule.selectors.map((sel: any) => {
              let newSel = sel.replace(/\bbody\b/g, '.cloned-content');
              if (!newSel.includes('.cloned-content')) newSel = '.cloned-content ' + newSel;
              return newSel;
            });
          }
        });
        styleContent = css.stringify(parsed);
      }
    } catch (e) {
      styleContent = `.cloned-content { ${styleContent} }`;
    }
    try {
      styleContent = rewriteCss(styleContent, clonedBase, apiBase);
    } catch { }
    headStyles.push(`<style>${styleContent}</style>`);
  }).remove();

  $('head link[rel="stylesheet"]').each((_: any, el: any) => {
    try {
      const href = $(el).attr('href');
      if (href) {
        try {
          const abs = absoluteUrl(clonedBase, href);
          $(el).attr('href', proxiedUrl(apiBase, abs));
        } catch { }
      }
    } catch { }
    headStyles.push($.html(el));
  }).remove();

  const $body = $('body');
  for (let i = headStyles.length - 1; i >= 0; i--) {
    $body.prepend(headStyles[i]);
  }

  $('body style').each((_: any, el: any) => {
    try {
      let styleContent = $(el).html() || '';
      try { styleContent = rewriteCss(styleContent, clonedBase, apiBase); } catch { }
      try {
        const parsed = css.parse(styleContent);
        if (parsed.stylesheet) {
          parsed.stylesheet.rules.forEach((rule: any) => {
            if (rule.type === 'rule' && rule.selectors) {
              rule.selectors = rule.selectors.map((sel: any) => {
                let newSel = sel.replace(/\bbody\b/g, '.cloned-content');
                if (!newSel.includes('.cloned-content')) newSel = '.cloned-content ' + newSel;
                return newSel;
              });
            }
          });
          styleContent = css.stringify(parsed);
        }
      } catch (e) {
        styleContent = `.cloned-content { ${styleContent} }`;
      }
      $(el).text(styleContent);
    } catch { }
  });

  const body = $('body').html() || '';
  const title = $('title').first().text().trim() || 'Annotation Page';
  const favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || $('link[rel="apple-touch-icon"]').attr('href') || '';

  return { title, favicon, body, scripts };
});
