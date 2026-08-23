# Run Checks

Use these commands before committing code changes.

## Unit Tests

```sh
npm run test
```

This runs Node's built-in test runner against `tests/*.test.ts`.

Important test groups:

- `textAnchor.test.ts`: text normalization, repeated quote matching, MathJax indexing
- `urlRewrite.test.ts`: frame/proxy URL rewriting
- `sanitizeHtml.test.ts`: saved excerpt sanitization
- `pastedHtml.test.ts`: R2 key generation for stored page HTML
- `frameCache.test.ts`: frame cache key partitioning
- `externalLinkInterceptor.test.ts`: iframe link handling
- `darkModeColor.test.ts`: dark mode color adjustment
- `pageTitle.test.ts`: stored title adoption

## Type Check

```sh
npm run typecheck
```

This runs `tsc --noEmit`.

## Lint

```sh
npm run lint
```

This runs the Vinext/Next lint command configured by the project.

## Build

```sh
npm run build
```

`prebuild` runs `npm run sync`, so a build may update generated sync files if
the remote schema changed.

## When To Add Tests

Add or update tests when changing:

- text anchor creation or matching
- DOM range wrapping or resizing
- sanitizer allowlists
- frame/proxy URL rewriting
- outbound fetch validation
- pasted HTML storage keys
- sync data normalization

Prefer tests around pure helpers in `core/` when possible. The app has several
browser-heavy features, but most risky behavior is factored into testable pure
functions.
