# HTML Annotation App

HTML Annotation App is an offline-capable web annotation tool. A user signs in, opens a web page inside the app, highlights text in the page, and saves notes against those highlights. The app keeps a local replica in the browser and syncs changes to Cloudflare D1.

The product name shown in the UI is "Annotation Studio".

## Start Here

If you are new to the codebase, read these in order:

1. [New Developer Onboarding](docs/ONBOARDING.md)
2. [Run the app locally](docs/tutorials/getting-started-local-dev.md)
3. [Architecture](docs/explanation/architecture.md)
4. [Annotation anchoring](docs/explanation/annotation-anchoring.md)
5. [Sync and auth](docs/explanation/sync-and-auth.md)
6. [Frame proxy and page cache](docs/explanation/frame-proxy-and-cache.md)

## Common Commands

```sh
npm ci
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
```

The dev server uses port `5001` by default:

```text
http://localhost:5001
```

## Documentation Map

The docs use the Diataxis framework:

- `docs/tutorials/` teaches a first successful workflow.
- `docs/how-to/` gives task recipes for day-to-day changes.
- `docs/reference/` lists facts: files, routes, schema, commands.
- `docs/explanation/` explains the design and tradeoffs.

See [docs/README.md](docs/README.md) for the full documentation index.

## Project Shape

- `app/` contains Next/Vinext routes, API routes, layout, and generated sync config.
- `components/` contains the dashboard, annotator UI, overlays, and local component packages.
- `core/` contains annotation, frame/proxy, persistence, sync, and utility logic.
- `public/sw.js` is the hand-maintained service worker for app shell, frame cache, and sync worker import.
- `worker/index.ts` is the Cloudflare Worker entry point.
- `migrations/` contains D1 migrations.
- `tests/` contains Node test coverage for the risky pure logic.

## Deployment Runtime

The app is built with Vinext/Next and deployed to Cloudflare Workers. Cloudflare
bindings are configured in [wrangler.jsonc](wrangler.jsonc):

- `DB`: D1 database for auth and sync data
- `WEBPAGES_BUCKET`: R2 bucket for user-pasted HTML fallbacks
- `ASSETS`: compiled static assets
- `IMAGES`: Cloudflare Images binding used by Vinext image optimization
