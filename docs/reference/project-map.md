# Project Map

This page is a quick lookup for where code lives.

## App Routes

- [app/layout.tsx](../../app/layout.tsx): global layout, sync provider, service worker registration, offline banner
- [app/page.tsx](../../app/page.tsx): dashboard route
- [app/[site]/[[...path]]/page.tsx](../../app/[site]/[[...path]]/page.tsx): annotator page route
- [app/frame/[site]/[[...path]]/route.ts](../../app/frame/[site]/[[...path]]/route.ts): iframe HTML proxy route
- [app/proxy/[site]/[[...path]]/route.ts](../../app/proxy/[site]/[[...path]]/route.ts): iframe asset proxy route

## API Routes

- `app/api/auth/*`: signup, login, logout, session
- [app/api/sync/pull/route.ts](../../app/api/sync/pull/route.ts): generated sync pull endpoint
- [app/api/sync/push/route.ts](../../app/api/sync/push/route.ts): generated sync push endpoint
- [app/api/websites/route.ts](../../app/api/websites/route.ts): server-side website lookup from sync state
- [app/api/webpages/route.ts](../../app/api/webpages/route.ts): save pasted HTML to R2
- [app/api/website-metadata/route.ts](../../app/api/website-metadata/route.ts): fetch title/logo candidates
- [app/api/website-logo/route.ts](../../app/api/website-logo/route.ts): proxy and cache site logo images

## Dashboard Components

- [components/Dashboard.tsx](../../components/Dashboard.tsx): top-level dashboard state and actions
- [components/dashboard/PageLibrary.tsx](../../components/dashboard/PageLibrary.tsx): saved page library view
- [components/dashboard/PageDetail.tsx](../../components/dashboard/PageDetail.tsx): saved page detail view
- [components/PageNoteEditor.tsx](../../components/PageNoteEditor.tsx): page-level note editor

## Annotator Components

- [components/SitePageClient.tsx](../../components/SitePageClient.tsx): client bridge from route to `Annotator`
- [components/Annotator.tsx](../../components/Annotator.tsx): iframe plus overlay composition
- [components/Annotator.context.tsx](../../components/Annotator.context.tsx): annotation data context
- [components/AnnotatorOverlay.context.tsx](../../components/AnnotatorOverlay.context.tsx): overlay state reducer
- [components/SelectionToolbar.tsx](../../components/SelectionToolbar.tsx): new highlight creation
- [components/FocusedAnnotationToolbar.tsx](../../components/FocusedAnnotationToolbar.tsx): selected highlight actions
- [components/AnnotationResizeHandles.tsx](../../components/AnnotationResizeHandles.tsx): resize behavior
- [components/AnnotationsPanel.tsx](../../components/AnnotationsPanel.tsx): side panel for page note and highlight list
- [components/PasteHtmlDialog.tsx](../../components/PasteHtmlDialog.tsx): blocked-page fallback input

## Annotation Core

- [core/annotation/model/index.ts](../../core/annotation/model/index.ts): text anchor model and matching
- [core/annotation/dom/dom.ts](../../core/annotation/dom/dom.ts): text indexing, range reconstruction, range wrapping
- [core/annotation/dom/highlight.ts](../../core/annotation/dom/highlight.ts): highlight geometry helpers
- [core/annotation/dom/sanitizeHtml.ts](../../core/annotation/dom/sanitizeHtml.ts): saved excerpt sanitizer
- [core/annotation/session/useAnnotationSession.ts](../../core/annotation/session/useAnnotationSession.ts): iframe session lifecycle
- [core/annotation/session/highlights.ts](../../core/annotation/session/highlights.ts): batch highlight application and anchor repair
- [core/annotation/session/title.ts](../../core/annotation/session/title.ts): page title adoption rules

## Frame And Proxy Core

- [core/frame/urlRewrite.ts](../../core/frame/urlRewrite.ts): URL resolution and rewrite helpers
- [core/frame/cache.ts](../../core/frame/cache.ts): client-side frame cache API
- [core/frame/cacheScope.ts](../../core/frame/cacheScope.ts): user-scoped frame cache search param helpers
- [core/frame/pastedHtml.ts](../../core/frame/pastedHtml.ts): R2 key normalization for stored HTML
- [core/frame/runtime/index.ts](../../core/frame/runtime/index.ts): iframe document preparation, reading mode, dark mode, link interception
- [core/frame/darkMode.ts](../../core/frame/darkMode.ts): dark mode color transforms
- [core/frame/externalLinks.ts](../../core/frame/externalLinks.ts): iframe link interception

## Persistence And Sync

- [core/persistence/syncRuntime.tsx](../../core/persistence/syncRuntime.tsx): sync provider and hooks
- [core/persistence/syncData.ts](../../core/persistence/syncData.ts): app-level row helpers
- [core/persistence/syncIdentity.ts](../../core/persistence/syncIdentity.ts): user/session/stream IDs
- [core/persistence/syncServerState.ts](../../core/persistence/syncServerState.ts): server reads from materialized sync state
- [core/persistence/useHighlightColors.ts](../../core/persistence/useHighlightColors.ts): seeded highlight colors
- [app/sync/server.ts](../../app/sync/server.ts): D1 sync authority
- [app/sync/sync.generated.ts](../../app/sync/sync.generated.ts): generated sync schema/config

## Platform

- [worker/index.ts](../../worker/index.ts): Cloudflare Worker entry point
- [public/sw.js](../../public/sw.js): app service worker and frame cache
- [public/sw.sync.js](../../public/sw.sync.js): generated sync worker imported by `sw.js`
- [wrangler.jsonc](../../wrangler.jsonc): Cloudflare bindings
- [vite.config.ts](../../vite.config.ts): Vinext, Cloudflare, and PWA build config

## Local Packages

- [components/design-system/README.md](../../components/design-system/README.md): local design system package
- [components/text-editor/README.md](../../components/text-editor/README.md): local text editor package
