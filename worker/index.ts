import type { Env } from "../utils/env";
import handler from "vinext/server/app-router-entry";

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    globalThis.__env = env;
    globalThis.__origin = new URL(request.url).origin;
    return handler.fetch(request);
  },
} satisfies ExportedHandler<Env>;
