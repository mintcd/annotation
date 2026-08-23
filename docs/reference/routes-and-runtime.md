# Routes And Runtime

## Page Routes

| Route | Runtime | File | Purpose |
| --- | --- | --- | --- |
| `/` | edge via layout | `app/page.tsx` | Dashboard. |
| `/{site}/{path...}` | edge | `app/[site]/[[...path]]/page.tsx` | Annotator page for a saved website/page path. |
| `/frame/{site}/{path...}` | edge | `app/frame/[site]/[[...path]]/route.ts` | Same-origin iframe HTML route. |
| `/proxy/{site}/{path...}` | default route handler runtime | `app/proxy/[site]/[[...path]]/route.ts` | Same-origin asset proxy for iframe resources. |

## API Routes

| Route | Runtime | Purpose |
| --- | --- | --- |
| `POST /api/auth/signup` | edge | Create user and session cookie. |
| `POST /api/auth/login` | edge | Verify credentials and set session cookie. |
| `POST /api/auth/logout` | edge | Clear session cookie. |
| `GET /api/auth/session` | edge | Return current sync session. |
| `POST /api/sync/pull` | nodejs | Sync-engine pull endpoint. |
| `POST /api/sync/push` | nodejs | Sync-engine push endpoint. |
| `GET /api/websites` | edge | Read website rows from current user's sync state. |
| `POST /api/webpages` | edge | Save pasted HTML to R2. |
| `GET /api/website-metadata` | edge | Fetch title and logo candidates for a site. |
| `GET /api/website-logo` | edge | Fetch and cache a selected logo image. |

## Middleware Proxy

[proxy.ts](../../proxy.ts) is the Next/Vinext middleware-style proxy function.
It does two jobs:

1. Rewrites iframe navigations to `/frame/{site}/...`.
2. Rewrites same-origin frame asset fallbacks to `/proxy/{site}/...` when a
   resource request came from a frame route.

It skips app internals such as `_next`, `/api`, `/frame`, `/proxy`, and static
favicon/robots paths.

## Cloudflare Worker

[worker/index.ts](../../worker/index.ts) is the Cloudflare Worker entry point.

It:

- stores Cloudflare bindings on `globalThis.__env`
- stores the request origin on `globalThis.__origin`
- handles Vinext image optimization at `/_vinext/image`
- delegates all other requests to Vinext's app router handler

Route handlers that need D1 or R2 call `getEnv()` from
[core/utils/env.ts](../../core/utils/env.ts).

## Service Workers

There are two service-worker files:

- [public/sw.js](../../public/sw.js): hand-maintained stable entry point
- [public/sw.sync.js](../../public/sw.sync.js): generated sync-engine worker

`sw.js` imports `sw.sync.js`, then adds:

- app-shell precache
- app navigation cache
- static asset/image caching
- offline-tolerant session endpoint caching
- per-frame document and asset caches
- website logo cache

## Cloudflare Bindings

Bindings are configured in [wrangler.jsonc](../../wrangler.jsonc):

| Binding | Type | Purpose |
| --- | --- | --- |
| `DB` | D1 | Auth and sync-engine storage. |
| `WEBPAGES_BUCKET` | R2 | User-pasted HTML fallback pages. |
| `ASSETS` | assets | Compiled client assets. |
| `IMAGES` | images | Cloudflare Images transformation for Vinext. |

## Generated Runtime Files

Do not edit:

- `app/sync/sync.generated.ts`
- `public/sw.sync.js`

Regenerate them with:

```sh
npm run sync
```
