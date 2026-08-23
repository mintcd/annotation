# Sync And Auth

The app is offline-first. Browser writes go to a local sync-engine replica first
and are pushed to Cloudflare D1 through sync routes.

## Sessions

The session cookie name is:

```text
html_annotation_user_id
```

Session helpers live in
[core/persistence/syncIdentity.ts](../../core/persistence/syncIdentity.ts).

Given a user ID, the app derives a sync stream ID:

```text
user:{normalizedUserId}
```

Anonymous sessions use:

```text
anonymous
```

The dashboard currently requires authentication before showing saved pages.
Offline session fallback exists so the app shell can still render from local
IndexedDB data when the network is unavailable.

## Auth

Auth routes live under [app/api/auth](../../app/api/auth).

Signup:

1. Normalize username.
2. Hash normalized username to get user ID.
3. Hash trimmed password.
4. Insert into `users`.
5. Set session cookie.

Login:

1. Normalize username.
2. Find user row.
3. Compare password hash.
4. Set session cookie.

Logout clears the cookie.

This is intentionally simple app auth, not a full identity system.

## Sync Provider

[core/persistence/syncRuntime.tsx](../../core/persistence/syncRuntime.tsx)
defines `SyncEngineProvider`.

It:

- fetches `/api/auth/session`
- opens sync-engine with `finalConfig`
- passes `streamId` for the current session
- enables initial sync
- enables sync on mutation
- exposes local rows with `useSyncRows(tableName)`

`useSyncStatus()` provides display-friendly state:

- `status`
- `isSyncing`
- `pendingCount`
- `error`
- `session`
- `sessionReady`

## Sync Server

[app/sync/server.ts](../../app/sync/server.ts) creates a D1 row-sync authority.

For each stream ID, it creates or reuses an authority configured with:

- D1 binding from `getEnv().DB`
- generated schema from `app/sync/sync.generated.ts`
- table prefix `html_annotation_sync`
- row projection into application tables

The generated API routes call:

- `syncServer.pull(request)`
- `syncServer.push(request)`

## App-Level Writes

UI code should prefer helpers from
[core/persistence/syncData.ts](../../core/persistence/syncData.ts):

- `ensurePage()`
- `getOrCreateWebsite()`
- `createAnnotationRow()`
- `updateAnnotationRow()`
- `deleteAnnotationRow()`
- `upsertPageNoteRow()`
- `upsertHighlightColorRow()`

Those helpers normalize data and trigger sync flushes.

## Why Some Writes Wait For Server Visibility

Most writes can be optimistic. For example, creating a highlight only needs the
local replica immediately.

Navigation is different. The server route `/{site}/{path}` resolves `{site}`
from the remote sync stream. If the client just created the website row locally,
the server may not see it yet.

That is why dashboard navigation calls `ensureWebsiteAvailableForRoute()` after
`getOrCreateWebsite()`. It polls `/api/websites?id={website.id}` until the row
is visible to the server or times out.

## Server Reads From Sync State

Server routes that need user data do not use browser IndexedDB. They read the
materialized D1 sync state through:

- `readSyncStreamState(session)`
- `getSyncStateRows(state, tableName)`
- `findSyncStateRow(state, tableName, column, value)`

These helpers live in
[core/persistence/syncServerState.ts](../../core/persistence/syncServerState.ts).

## Service Worker Sync

`public/sw.js` imports generated `public/sw.sync.js`.

`sw.sync.js` handles sync-engine background messages and proxies sync requests
to:

- `/api/sync/pull`
- `/api/sync/push`

The hand-maintained `sw.js` adds app caching and frame caching around that.

## Important Boundaries

- Browser UI writes to the local sync replica.
- Server routes read D1 sync state for the current cookie user.
- Generated sync files should be regenerated, not edited.
- Some user-visible actions may be locally successful but still pending remote
  confirmation.
