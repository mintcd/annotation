# Commands

Commands are defined in [package.json](../../package.json).

## Development

```sh
npm run dev
```

Runs:

```sh
vinext dev --port 5001 --host 0.0.0.0
```

Open:

```text
http://localhost:5001
```

## Sync Generation

```sh
npm run sync
```

Runs sync-engine generation using [sync.next.config.ts](../../sync.next.config.ts).

Outputs:

- `app/sync/sync.generated.ts`
- `public/sw.sync.js`

## Checks

```sh
npm run test
npm run typecheck
npm run lint
```

## Build

```sh
npm run build
```

`prebuild` runs `npm run sync`.

## Deploy

```sh
npm run deploy
```

Runs Vinext deployment for the Cloudflare Worker configuration.

## Start Built App

```sh
npm run start
```

Runs the Vinext start command for the built app.
