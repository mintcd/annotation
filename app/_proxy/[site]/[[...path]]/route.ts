// ─── Asset Proxy ─────────────────────────────────────────────────────────────
//
// This route is never hit directly by the browser. Next.js middleware rewrites
// /{site-slug}/path/to/file.ext → /_proxy/{site-slug}/path/to/file.ext so that
// asset URLs in cloned pages look like  /plato-stanford-edu/scripts/app.js
// while this handler fetches the real upstream content.
//
// Because the browser believes the asset lives at /{slug}/path/, relative
// imports/url() values resolve correctly without any rewriting.
// We only need to rewrite ROOT-RELATIVE paths ( /absolute ) that would
// otherwise resolve against the app's own origin instead of the site's.

import { getEnv } from "../../../../utils/env";

/** Appended to every proxied script — mirrors the snippet in clone.ts. */
function makeSignalSnippet(url: string): string {
  const payload = JSON.stringify({ url });
  return `\n\n;// Proxy execution signal - do not remove\n(function(){try{var d=${payload};if(typeof window!=='undefined'){window.__proxy_script_executed=window.__proxy_script_executed||[];window.__proxy_script_executed.push(d.id||d.url);if(typeof window.__proxy_script_executed_dispatch!=='function'){window.__proxy_script_executed_dispatch=function(detail){try{var ev;try{ev=new CustomEvent('proxy:script-executed',{detail:detail});}catch(e){ev=document.createEvent('CustomEvent');ev.initCustomEvent('proxy:script-executed',false,false,detail);}if(typeof window!=='undefined'&&window.dispatchEvent){window.dispatchEvent(ev);}}catch(e){if(typeof console!=='undefined'&&console.warn)console.warn('proxy dispatch error',e);}}}try{window.__proxy_script_executed_dispatch(d);}catch(e){}}  }catch(err){if(typeof console!=='undefined'&&console.warn)console.warn('proxy signal error',err);} })();\n`;
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin || "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        request.headers.get("access-control-request-headers") || "Range",
      "Access-Control-Max-Age": "600",
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { site: string; path?: string[] } }
) {
  const reqUrl = new URL(request.url);
  const { site, path } = params;

  // ── 1. Resolve origin from the websites table ────────────────────────────
  let siteOrigin: string;
  try {
    const env = getEnv();
    const row = await env.DB.prepare(
      "SELECT origin FROM websites WHERE id = ?"
    )
      .bind(site)
      .first<{ origin: string }>();

    if (!row) {
      return new Response(`Unknown site slug: ${site}`, { status: 404 });
    }
    siteOrigin = row.origin; // e.g. "https://plato.stanford.edu"
  } catch {
    return new Response("Database unavailable", { status: 503 });
  }

  // ── 2. Build upstream URL ────────────────────────────────────────────────
  const pathname = path?.length ? "/" + path.join("/") : "/";
  const search = reqUrl.search || "";
  const targetUrl = `${siteOrigin}${pathname}${search}`;

  // ── 3. Fetch upstream ────────────────────────────────────────────────────
  const upstream = await fetch(targetUrl, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!upstream.ok) {
    return new Response(
      `Upstream fetch failed: ${upstream.status} ${upstream.statusText}`,
      { status: 502 }
    );
  }

  const ct = upstream.headers.get("Content-Type") || "";
  const corsOrigin = request.headers.get("origin") || "*";

  const isScript =
    ct.includes("javascript") ||
    ct.includes("typescript") ||
    ct.includes("ecmascript");
  const isScriptFile =
    pathname.endsWith(".js") ||
    pathname.endsWith(".mjs") ||
    pathname.endsWith(".cjs") ||
    pathname.endsWith(".ts") ||
    pathname.endsWith(".mts") ||
    pathname.endsWith(".jsx") ||
    pathname.endsWith(".tsx");
  const isCss = ct.includes("text/css") || pathname.endsWith(".css");

  // ── 4. Text assets: targeted rewriting ──────────────────────────────────
  if (isScript || isScriptFile || isCss) {
    let text = await upstream.text();

    // Relative paths (./foo, ../bar) resolve correctly because the browser
    // treats the asset URL as the base. Only ROOT-RELATIVE paths (/absolute)
    // point at the wrong origin and must be prefixed with /_proxy/{slug}.

    if (isScript || isScriptFile) {
      // Root-relative fetch / XHR / URL constructor / direct string references
      text = text
        // fetch('/path')
        .replace(
          /\bfetch\s*\(\s*(["'])(\/[^"'#?][^"']*)\1/g,
          (_m, q, p) => `fetch(${q}/_proxy/${site}${p}${q}`
        )
        // new URL('/path', ...)  or  new URL('/path')
        .replace(
          /\bnew\s+URL\s*\(\s*(["'])(\/[^"'#?][^"']*)\1/g,
          (_m, q, p) => `new URL(${q}/_proxy/${site}${p}${q}`
        )
        // XMLHttpRequest .open('METHOD', '/path')
        .replace(
          /(\.open\s*\(\s*["'][^"']+["']\s*,\s*)(["'])(\/[^"'#?][^"']*)\2/g,
          (_m, before, q, p) => `${before}${q}/_proxy/${site}${p}${q}`
        )
        // url: '/path'  (common config objects)
        .replace(
          /\burl\s*:\s*(["'])(\/[^"'#?][^"']*)\1/g,
          (_m, q, p) => `url: ${q}/_proxy/${site}${p}${q}`
        )
        // src: '/path'  (less common but present in loaders)
        .replace(
          /\bsrc\s*:\s*(["'])(\/[^"'#?][^"']*)\1/g,
          (_m, q, p) => `src: ${q}/_proxy/${site}${p}${q}`
        );

      // Append signal snippet so useIframeTracking can count script executions.
      text += makeSignalSnippet(targetUrl);

      const contentType =
        (pathname.endsWith(".ts") ||
          pathname.endsWith(".mts") ||
          pathname.endsWith(".tsx")) &&
          !ct.includes("text/")
          ? "application/javascript; charset=utf-8"
          : ct || "application/javascript; charset=utf-8";

      return new Response(text, {
        status: upstream.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control":
            upstream.headers.get("Cache-Control") ?? "public, max-age=3600",
          "Access-Control-Allow-Origin": corsOrigin,
        },
      });
    }

    // CSS — rewrite root-relative url() values and same-origin absolute ones.
    text = text.replace(
      /url\s*\(\s*(['"]?)([^'"\s)]+)\1\s*\)/g,
      (match, quote, cssUrl) => {
        cssUrl = cssUrl.trim();
        if (
          cssUrl.startsWith("data:") ||
          cssUrl.startsWith("blob:") ||
          cssUrl.startsWith("//")
        )
          return match;

        // Root-relative: /path → /_proxy/{slug}/path
        if (cssUrl.startsWith("/")) {
          return `url(${quote}/_proxy/${site}${cssUrl}${quote})`;
        }

        // Absolute same-origin: https://example.com/path → /_proxy/{slug}/path
        if (cssUrl.startsWith("http://") || cssUrl.startsWith("https://")) {
          try {
            const u = new URL(cssUrl);
            if (u.origin === siteOrigin) {
              return `url(${quote}/_proxy/${site}${u.pathname}${u.search}${quote})`;
            }
          } catch {/* leave unchanged */ }
        }

        // Relative paths resolve correctly — leave them alone.
        return match;
      }
    );

    // CSS @import with root-relative / absolute paths
    text = text.replace(
      /@import\s+(['"]) (\/[^'"]+)\1/g,
      (_m, q, p) => `@import ${q}/_proxy/${site}${p}${q}`
    );

    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": ct || "text/css; charset=utf-8",
        "Cache-Control":
          upstream.headers.get("Cache-Control") ?? "public, max-age=3600",
        "Access-Control-Allow-Origin": corsOrigin,
      },
    });
  }

  // ── 5. Binary / other assets — stream through unchanged ─────────────────
  const headers = new Headers();
  if (ct) headers.set("Content-Type", ct);
  headers.set(
    "Cache-Control",
    upstream.headers.get("Cache-Control") ?? "public, max-age=31536000, immutable"
  );
  headers.set("Access-Control-Allow-Origin", corsOrigin);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
