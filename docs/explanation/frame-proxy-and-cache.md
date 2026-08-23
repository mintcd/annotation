# Frame Proxy And Page Cache

The frame/proxy layer is what makes arbitrary page annotation possible.

## Why Not Load The Original URL Directly?

If the app loaded `https://example.com/article` directly in an iframe, browser
same-origin rules would prevent the parent app from reading the iframe DOM.

The annotator needs DOM access to:

- read the current text selection
- create DOM ranges
- inject highlight spans
- intercept links
- measure highlight positions
- apply reading mode and dark mode

So the app serves the page from its own origin through `/frame/...`.

## Frame Route

[app/frame/[site]/[[...path]]/route.ts](../../app/frame/[site]/[[...path]]/route.ts)
serves iframe HTML.

It:

1. Reads the current user session.
2. Reads the user's synced `websites` row for `{site}`.
3. Checks R2 for user-pasted HTML for this page.
4. If no pasted HTML exists, fetches upstream HTML from the source site.
5. Removes frame-blocking CSP/X-Frame metadata.
6. Rewrites same-origin resource URLs to `/proxy/{site}/...`.
7. Returns the rewritten HTML with `X-Frame-Options: SAMEORIGIN`.

If fetching fails, it returns a small fallback document containing:

```html
<meta name="frame-error" content="...">
```

The parent annotator detects that marker and offers the pasted HTML fallback.

## Asset Proxy

[app/proxy/[site]/[[...path]]/route.ts](../../app/proxy/[site]/[[...path]]/route.ts)
fetches rewritten frame assets.

It:

- resolves `{site}` to the stored origin
- fetches the source asset
- streams binary assets through
- returns text assets with useful content-type and CORS headers

The route is deliberately same-origin from the browser's point of view. That
keeps relative imports and CSS references inside proxied assets flowing back
through the app.

## Middleware Fallback

[proxy.ts](../../proxy.ts) handles requests that the frame creates at runtime.

Some pages generate relative asset URLs after load. Those requests may hit the
app origin without already being rewritten. The middleware uses the frame
referer or `__proxy_site` cookie to rewrite those asset requests to `/proxy`.

## Pasted HTML

Some sites block server-side fetches. The user can paste page source manually.

The save path is:

1. `PasteHtmlDialog` posts to `/api/webpages`.
2. The API validates the current user and site.
3. The API stores the HTML in R2 under a user-scoped key.
4. The frame route finds that R2 object on the next load.

Stored HTML is treated differently from fetched HTML:

- scripts are disabled
- inline event handlers are removed
- iframes are sandboxed
- a `<base>` tag points relative assets to the original source URL

That keeps a pasted copy useful while avoiding execution of arbitrary stored
page scripts.

## Frame Cache

The frame cache has a browser-side API in
[core/frame/cache.ts](../../core/frame/cache.ts) and a service-worker
implementation in [public/sw.js](../../public/sw.js).

The cache is partitioned by normalized frame URL and user scope. This prevents
two users or two query variants from sharing the wrong saved frame bundle.

The annotations panel refresh action calls `session.reloadFrame()`, which calls
`refreshFrameBundle()`. That:

1. fetches the frame document with a refresh header
2. stores the new document in Cache Storage
3. tells the service worker to refresh assets for a short window
4. reloads the iframe

The service worker refuses to cache frame error documents so a temporary fetch
failure does not replace a good saved page.

## Design Tradeoffs

This layer is complex because it is crossing browser security boundaries in the
only acceptable direction: source content is copied into the app origin instead
of the app reaching into a cross-origin page.

The costs are:

- source sites can block server-side fetches
- HTML rewriting is incomplete by nature
- dynamic resources may need middleware fallback
- service-worker caching must be careful not to cache errors
- stored HTML needs stricter script disabling

The benefit is that the annotation UI can work with real DOM selections and
offline saved page bundles.
