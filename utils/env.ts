// ─── Cloudflare Env Accessor ─────────────────────────────────────────────────
// The worker entry (worker/index.ts) injects `env` onto globalThis before
// handing the request to vinext. Route handlers that need D1 / R2 bindings
// call `getEnv()` to retrieve it.

export interface Env {
  DB: D1Database;
  ANNOTATIONS_BUCKET: R2Bucket;
  WEBPAGES_BUCKET: R2Bucket;
}

declare global {
  // eslint-disable-next-line no-var
  var __env: Env | undefined;
  // eslint-disable-next-line no-var
  var __origin: string | undefined;
}

export function getEnv(): Env {
  const env = globalThis.__env;
  if (!env) throw new Error("Cloudflare env not available (missing globalThis.__env)");
  return env;
}
