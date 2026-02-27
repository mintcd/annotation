// ─── Proxy ───────────────────────────────────────────────────────────────────

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
  { params }: { params: { slug: string[] } }
) {
  const url = new URL(request.url);
  const slug = params.slug;

  if (!slug.length) return new Response("Missing target", { status: 400 });

  let protocol = "http";
  let host = "";
  let pathParts: string[];

  if (slug[0] === "http" || slug[0] === "https") {
    if (slug.length < 2) return new Response("Missing host", { status: 400 });
    protocol = slug[0];
    host = slug[1];
    pathParts = slug.slice(2);
  } else {
    host = slug[0];
    pathParts = slug.slice(1);
  }

  const pathname = "/" + pathParts.join("/");
  const search = url.search || "";
  const targetUrl = `${protocol}://${host}${pathname}${search}`;

  const requestHost = request.headers.get("host");
  const requestProto =
    request.headers.get("x-forwarded-proto") || url.protocol.replace(/:$/, "");
  const apiBase = requestHost
    ? `${requestProto}://${requestHost}`
    : url.origin;
  const origin = request.headers.get("origin");

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
  const headers = new Headers();
  if (ct) headers.set("Content-Type", ct);
  headers.set(
    "Cache-Control",
    upstream.headers.get("Cache-Control") ??
    "public, max-age=31536000, immutable"
  );
  headers.set("Access-Control-Allow-Origin", origin || "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");

  const isScript =
    ct.includes("javascript") ||
    ct.includes("typescript") ||
    ct.includes("ecmascript");
  const isScriptFile =
    pathname.endsWith(".js") ||
    pathname.endsWith(".ts") ||
    pathname.endsWith(".mjs") ||
    pathname.endsWith(".mts") ||
    pathname.endsWith(".jsx") ||
    pathname.endsWith(".tsx");
  const isCss = ct.includes("text/css");
  const isCssFile = pathname.endsWith(".css");

  if (isScript || isScriptFile || isCss || isCssFile) {
    let text = await upstream.text();
    const proxyBase = `${apiBase}/proxy/${protocol}/${host}`;

    if (isScript || isScriptFile) {
      // Rewrite import/export from statements
      text = text.replace(
        /(from\s+["'])(\.?\.?\/[^"']+)(["'])/g,
        (match, before, path, after) => {
          if (path.startsWith("http://") || path.startsWith("https://"))
            return match;
          const resolvedPath = path.startsWith("/") ? path : `/${path}`;
          return `${before}${proxyBase}${resolvedPath}${after}`;
        }
      );
      // Rewrite dynamic imports
      text = text.replace(
        /import\s*\(\s*["'](\.?\.?\/[^"']+)["']\s*\)/g,
        (match, path) => {
          if (path.startsWith("http://") || path.startsWith("https://"))
            return match;
          const resolvedPath = path.startsWith("/") ? path : `/${path}`;
          return `import("${proxyBase}${resolvedPath}")`;
        }
      );
      // Fix inlined url: properties
      text = text.replace(
        /url\s*:\s*["'](\/[^"']*)["']/g,
        (_match, p1) => `url: "${proxyBase}${p1}"`
      );
      // Rewrite absolute URLs pointing to worker domains
      text = text.replace(
        /["'](https?:\/\/[^\/]+\.workers\.dev\/proxy\/[^"']+)["']/g,
        (match, fullUrl) => {
          try {
            const u = new URL(fullUrl);
            return `"${apiBase}${u.pathname}${u.search}"`;
          } catch {
            return match;
          }
        }
      );
      // Rewrite new URL() with relative paths
      text = text.replace(
        /new\s+URL\s*\(\s*["'](\/[^"']+)["']/g,
        (_match, path) => `new URL("${proxyBase}${path}"`
      );
      // Rewrite fetch() with relative URLs
      text = text.replace(
        /fetch\s*\(\s*["'](\/[^"']+)["']/g,
        (_match, path) => `fetch("${proxyBase}${path}"`
      );
      // Rewrite XMLHttpRequest.open()
      text = text.replace(
        /(\.open\s*\(\s*["'][^"']+["']\s*,\s*["'])(\/[^"']+)(["'])/g,
        (_match, before, path, after) =>
          `${before}${proxyBase}${path}${after}`
      );

      const contentType =
        (pathname.endsWith(".ts") ||
          pathname.endsWith(".mts") ||
          pathname.endsWith(".tsx")) &&
          !ct?.includes("text/")
          ? "application/javascript; charset=utf-8"
          : ct || "application/javascript; charset=utf-8";

      return new Response(text, {
        status: upstream.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control":
            upstream.headers.get("Cache-Control") ?? "public, max-age=3600",
          "Access-Control-Allow-Origin": origin || "*",
        },
      });
    }

    // CSS rewriting
    text = text.replace(
      /url\s*\(\s*(['"]?)([^'")]+)\1\s*\)/g,
      (match, quote, cssUrl) => {
        cssUrl = cssUrl.trim();
        if (
          cssUrl.startsWith("data:") ||
          cssUrl.startsWith("http://") ||
          cssUrl.startsWith("https://") ||
          cssUrl.startsWith("//")
        )
          return match;

        let absoluteUrl: string;
        if (cssUrl.startsWith("/")) {
          absoluteUrl = `${protocol}://${host}${cssUrl}`;
        } else {
          const baseUrl = `${protocol}://${host}${pathname}`;
          const basePath = baseUrl.substring(0, baseUrl.lastIndexOf("/") + 1);
          absoluteUrl = new URL(cssUrl, basePath).href;
        }
        const u = new URL(absoluteUrl);
        return `url(${quote}${apiBase}/proxy/${protocol}/${u.host}${u.pathname}${u.search}${quote})`;
      }
    );

    return new Response(text, {
      status: upstream.status,
      headers: {
        "Content-Type": ct || "text/css; charset=utf-8",
        "Cache-Control":
          upstream.headers.get("Cache-Control") ?? "public, max-age=3600",
        "Access-Control-Allow-Origin": origin || "*",
      },
    });
  }

  // Pass through non-text assets (images, fonts, etc.)
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
