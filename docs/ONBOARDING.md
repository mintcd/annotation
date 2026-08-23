# New Developer Onboarding

This guide is written for a developer who did not write the app and wants enough
understanding to make safe changes.

## Project Overview

HTML Annotation App lets a signed-in user:

1. Enter a web page URL.
2. Open that page inside an app-controlled iframe.
3. Select text and create highlights.
4. Attach notes to highlights or to the whole page.
5. Keep working offline while local changes sync to Cloudflare D1 later.

The codebase is a Vinext/Next app that runs on Cloudflare Workers. Browser data
is managed by `@mintcd/sync-engine`, and server-side sync state is stored in D1.
User-pasted HTML fallbacks are stored in R2.

## The Mental Model

The app has four major systems:

1. App shell and dashboard

   The root route renders the dashboard. Users authenticate, search saved pages,
   manage highlight colors, and choose a page to annotate.

2. Same-origin frame proxy

   Source pages cannot be annotated safely as arbitrary cross-origin iframes.
   The app fetches page HTML through `/frame/{site}/...`, rewrites same-origin
   page assets through `/proxy/{site}/...`, and serves the result from the app's
   own origin. That gives the parent React app access to the iframe document.

3. Annotation session

   The annotator waits for the iframe to load, prepares the iframe document,
   detects user selections, turns selections into text anchors, saves annotation
   rows, and injects visual highlight spans.

4. Offline-first sync

   UI code writes to the local sync replica first. Sync-engine then pushes and
   pulls row changes through `/api/sync/push` and `/api/sync/pull`. Server routes
   use the auth cookie to choose a per-user sync stream.

## First Code Tour

Read these files in this order:

1. [app/layout.tsx](../app/layout.tsx)

   Registers global CSS, wraps the app in `SyncEngineProvider`, and mounts
   service-worker/offline UI helpers.

2. [app/page.tsx](../app/page.tsx)

   The root page only renders `Dashboard`.

3. [components/Dashboard.tsx](../components/Dashboard.tsx)

   Handles session states, login/signup, saved page search, page deletion, page
   notes, website metadata, highlight colors, and navigation into the annotator.

4. [app/[site]/[[...path]]/page.tsx](../app/[site]/[[...path]]/page.tsx)

   Resolves a route such as `/example-com/article` into the original page URL
   using the synced `websites` row for the current user.

5. [components/SitePageClient.tsx](../components/SitePageClient.tsx)

   Ensures a `pages` row exists, then mounts `Annotator`.

6. [components/Annotator.tsx](../components/Annotator.tsx)

   Renders the iframe and all overlay layers: annotations panel, selection
   toolbar, focused highlight toolbar, dialogs, and feedback.

7. [core/annotation/session/useAnnotationSession.ts](../core/annotation/session/useAnnotationSession.ts)

   Owns the iframe lifecycle: load, prepare, title detection, reading mode,
   dark mode, annotation reapplication, refresh, and link handling.

8. [components/Annotator.context.tsx](../components/Annotator.context.tsx)

   Provides annotation data and mutation methods to the annotator UI.

9. [core/annotation/dom/dom.ts](../core/annotation/dom/dom.ts)

   Builds the visible text index, creates text anchors, resolves anchors back
   to DOM ranges, and wraps ranges with highlight spans.

10. [core/persistence/syncData.ts](../core/persistence/syncData.ts)

    Contains the app-level row helpers used by UI code. Most feature changes
    that touch saved data pass through this file.

11. [app/frame/[site]/[[...path]]/route.ts](../app/frame/[site]/[[...path]]/route.ts)

    Fetches or loads page HTML, strips frame-blocking metadata, rewrites assets,
    and serves iframe HTML.

12. [public/sw.js](../public/sw.js)

    Handles app-shell caching, imports the generated sync worker, and owns the
    frame/page asset cache.

## Main User Flow

1. The user signs in from `Dashboard`.
2. `SyncEngineProvider` loads `/api/auth/session`.
3. The user enters a URL.
4. `Dashboard` calls `ensurePage()` and `getOrCreateWebsite()`.
5. The app navigates to `/{website.id}/{path}`.
6. The server page resolves `website.id` back to the origin from the user's sync
   stream.
7. `SitePageClient` mounts `Annotator` with:

   - `pageUrl`: canonical original page URL
   - `iframeUrl`: same-origin `/frame/...` URL
   - frame storage identifiers used by pasted HTML fallback

8. `/frame/...` fetches source HTML or loads pasted HTML from R2.
9. `useAnnotationSession()` prepares the iframe document.
10. Existing annotations are matched and highlighted.
11. New selections are converted to `TextAnchor` objects and saved.
12. Sync-engine flushes local changes to D1.

## Key Concepts

### Website IDs Are Route Slugs

`websites.id` is a slug derived from the origin. For example:

```text
https://plato.stanford.edu -> plato-stanford-edu
```

The slug is used in app routes, but the origin remains the source of truth for
building upstream URLs.

### Page URLs Are Normalized

Pages are stored by canonical URL. Use `normalizeUrl()` before comparing page
URLs.

### Annotations Store Text Anchors, Not DOM Paths

The current model stores `exact`, `prefix`, and `suffix` text. Runtime code
normalizes that into a `TextAnchor` object. This survives many page changes
better than child-index DOM paths.

### Highlight Spans Are Presentation Only

`span.highlighted-text[data-highlight-id]` is injected into the iframe document
for display. It should never be treated as source content. Code that saves HTML
excerpts removes these spans first.

### The Iframe Must Be Same-Origin

The parent app needs `iframe.contentDocument` to read selections, create ranges,
inject highlights, and measure highlight rectangles. That is why the app fetches
and rewrites pages instead of loading source URLs directly.

### Sync Writes Are Optimistic

Most UI writes update local replica state first, then request a sync flush. A
user may see "queued", "pending", or "syncing" states while D1 catches up.

## Where To Make Changes

For dashboard layout or saved page behavior:

- [components/Dashboard.tsx](../components/Dashboard.tsx)
- [components/dashboard/PageLibrary.tsx](../components/dashboard/PageLibrary.tsx)
- [components/dashboard/PageDetail.tsx](../components/dashboard/PageDetail.tsx)

For in-page annotation behavior:

- [components/SelectionToolbar.tsx](../components/SelectionToolbar.tsx)
- [components/FocusedAnnotationToolbar.tsx](../components/FocusedAnnotationToolbar.tsx)
- [components/AnnotationResizeHandles.tsx](../components/AnnotationResizeHandles.tsx)
- [components/AnnotationsPanel.tsx](../components/AnnotationsPanel.tsx)
- [components/Annotator.context.tsx](../components/Annotator.context.tsx)

For matching and highlight injection:

- [core/annotation/model/index.ts](../core/annotation/model/index.ts)
- [core/annotation/dom/dom.ts](../core/annotation/dom/dom.ts)
- [core/annotation/session/highlights.ts](../core/annotation/session/highlights.ts)

For iframe loading and resource rewriting:

- [app/frame/[site]/[[...path]]/route.ts](../app/frame/[site]/[[...path]]/route.ts)
- [app/proxy/[site]/[[...path]]/route.ts](../app/proxy/[site]/[[...path]]/route.ts)
- [proxy.ts](../proxy.ts)
- [core/frame/urlRewrite.ts](../core/frame/urlRewrite.ts)
- [public/sw.js](../public/sw.js)

For synced data:

- [core/persistence/syncData.ts](../core/persistence/syncData.ts)
- [core/persistence/syncRuntime.tsx](../core/persistence/syncRuntime.tsx)
- [sync.next.config.ts](../sync.next.config.ts)
- [app/sync/server.ts](../app/sync/server.ts)
- [app/sync/sync.generated.ts](../app/sync/sync.generated.ts)

For auth:

- [app/api/auth/_shared.ts](../app/api/auth/_shared.ts)
- [app/api/auth/signup/route.ts](../app/api/auth/signup/route.ts)
- [app/api/auth/login/route.ts](../app/api/auth/login/route.ts)
- [app/api/auth/session/route.ts](../app/api/auth/session/route.ts)
- [core/persistence/syncIdentity.ts](../core/persistence/syncIdentity.ts)

## Complexity Hotspots

Treat these areas carefully and add tests when changing them:

- Text anchoring and range reconstruction
- Highlight resizing
- Frame/proxy URL rewriting
- Service-worker frame cache behavior
- Sync schema changes
- Outbound fetch restrictions
- Stored/pasted HTML sanitization and script disabling

## Known Maintenance Notes

- `app/sync/sync.generated.ts` is generated. Do not edit it by hand.
- `public/sw.sync.js` is generated. Do not edit it by hand.
- `public/sw.js` is hand-maintained and imports `sw.sync.js`.
- The checked-in migrations do not fully describe every column in the current
  generated sync schema. In particular, the generated schema includes
  `annotations.exact`, `annotations.prefix`, `annotations.suffix`, and
  `page_notes`. Before recreating a fresh D1 database from migrations, add or
  recover the missing migrations.

## Next Reading

- [Run the app locally](tutorials/getting-started-local-dev.md)
- [Architecture](explanation/architecture.md)
- [Annotation anchoring](explanation/annotation-anchoring.md)
- [Data model](reference/data-model.md)
