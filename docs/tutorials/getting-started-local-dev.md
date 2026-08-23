# Run The App Locally

This tutorial gets you from a fresh checkout to creating your first local
annotation.

## Prerequisites

Install:

- Node.js 20 or newer
- npm
- Wrangler access to the Cloudflare account used by this project

The app uses remote Cloudflare D1 and R2 bindings in [wrangler.jsonc](../../wrangler.jsonc).
If your Cloudflare login cannot access those resources, the app shell may start
but auth, sync, page metadata, and pasted HTML storage will fail.

## 1. Install Dependencies

From the repository root:

```sh
npm ci
```

## 2. Generate Sync Files

The sync config and generated sync service worker are derived from
[sync.next.config.ts](../../sync.next.config.ts):

```sh
npm run sync
```

This updates:

- `app/sync/sync.generated.ts`
- `public/sw.sync.js`

Do not edit those generated files by hand.

## 3. Start The Dev Server

```sh
npm run dev
```

The project script starts Vinext on port `5001`:

```text
http://localhost:5001
```

## 4. Sign In

Open the dev URL in your browser.

Use the signup tab to create a test account. The account is stored in D1 and the
browser receives an `html_annotation_user_id` cookie. That cookie selects your
sync stream.

## 5. Open A Page

Enter a public HTTPS URL in the dashboard. The app will:

1. Normalize the URL.
2. Create or reuse a `websites` row for the origin.
3. Create or reuse a `pages` row for the full URL.
4. Navigate to `/{website.id}/{path}`.
5. Load the page through `/frame/{website.id}/{path}`.

If automatic page loading fails, use the "Paste HTML" action in the annotations
panel. That stores a static page source copy in R2 and reloads the frame from
that stored HTML.

## 6. Create A Highlight

In the iframe:

1. Select visible text.
2. Click "Highlight".
3. Open the annotations panel.
4. Add a note to the highlight.

The important implementation detail is that the app creates a text anchor before
it wraps the selected text with highlight spans.

## 7. Run Checks

```sh
npm run test
npm run typecheck
npm run lint
```

The tests focus on the pure logic that is easy to break: text anchoring,
sanitization, frame cache keys, URL rewriting, dark mode color transforms, page
title handling, and pasted HTML storage keys.

## Troubleshooting

If the dashboard stays on "Opening session", check `/api/auth/session` in the
browser network panel.

If signup or login fails, check D1 access and the `users` table.

If a page route says "Unknown site", the client wrote the website row locally
but the server could not read it from the remote sync stream yet. The dashboard
tries to wait for that with `ensureWebsiteAvailableForRoute()`.

If a frame fails to load, read [Debug a page that will not load](../how-to/debug-page-loading.md).
