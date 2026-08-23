# Architecture

The app is easiest to understand as a layered system.

```text
Browser UI
  Dashboard
  Annotator overlays
  Same-origin iframe

Client state
  SyncEngineProvider
  IndexedDB/local replica
  Service worker cache

Server routes
  Auth API
  Sync API
  Frame route
  Asset proxy route
  Metadata/logo routes

Cloudflare platform
  Worker
  D1
  R2
  Static assets
```

## Browser UI

The dashboard and annotator are React client components.

`Dashboard` is the home screen. It handles account state, saved pages,
highlight colors, search, and navigation to the annotator.

`Annotator` owns the in-page workspace. It renders:

- an iframe for the page being annotated
- the annotations panel
- a toolbar for a new text selection
- a toolbar for an existing highlight
- resize handles
- dialogs for external links and pasted HTML
- loading/error feedback

The annotator UI is split into two contexts:

- `Annotator.context.tsx`: annotation data and write methods
- `AnnotatorOverlay.context.tsx`: overlay/panel/dialog state

That split matters. Data state changes because sync rows change. Overlay state
changes because the user opens a panel, selects text, clicks a highlight, or
opens a dialog.

## Same-Origin Iframe

The original source page is not loaded directly. Instead, the app loads:

```text
/frame/{site}/{path}
```

The frame route fetches source HTML, rewrites same-origin assets to app routes,
and returns an HTML document from this app's origin.

That is what lets the parent app access:

```ts
iframe.contentDocument
```

Without same-origin iframe access, the annotator could not inspect selections,
create DOM ranges, wrap highlights, or measure highlight positions.

## Client State

`SyncEngineProvider` wraps the app in [app/layout.tsx](../../app/layout.tsx).

It:

- fetches `/api/auth/session`
- derives a sync stream ID from the current user
- opens the sync-engine local replica
- exposes row data with `useSyncRows(tableName)`
- exposes write/runtime state with `useSyncRuntime()`

Most components do not talk directly to sync-engine tables. They use helpers
from `core/persistence/syncData.ts`.

## Server Routes

The server side has three important responsibilities:

1. Auth

   `/api/auth/*` stores simple username/password credentials in D1 and sets an
   `html_annotation_user_id` cookie.

2. Sync

   `/api/sync/push` and `/api/sync/pull` are generated wrappers around
   `app/sync/server.ts`. That server creates a D1 row-sync authority for the
   current user's stream.

3. Frame/proxy

   `/frame/...` fetches HTML and rewrites it. `/proxy/...` fetches resources
   referenced by rewritten pages.

## Cloudflare Platform

The Cloudflare Worker entry point is [worker/index.ts](../../worker/index.ts).
It injects `env` into `globalThis.__env` so route handlers can use D1, R2,
assets, and images bindings through `getEnv()`.

The configured bindings are in [wrangler.jsonc](../../wrangler.jsonc).

## Why The App Is Structured This Way

The unusual part is the same-origin iframe proxy. It exists because the core
product requirement is direct DOM annotation of arbitrary pages. Browser
cross-origin isolation normally prevents that.

The tradeoff is complexity:

- HTML must be rewritten.
- Assets sometimes need proxy fallback rewriting.
- Source sites may block server-side fetches.
- The service worker needs per-page frame caches.
- Stored pasted HTML needs script disabling.

Most of the rest of the architecture exists to make that tradeoff usable:

- sync-engine keeps annotation writes offline-first
- text anchors survive changed page DOM better than DOM paths
- R2 pasted HTML fallback handles blocked source pages
- service-worker caching keeps saved pages available offline
