import { getEnv } from "../../../utils/env";
import { json, err, now } from "../../../utils/api-helpers";

interface CookieRow {
  site_id: string;
  cookie: string;
  updated_at: string;
}

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const site = url.searchParams.get("site");
  if (!site) return err("Missing required param: site", 400);

  const row = await env.DB.prepare(
    "SELECT site_id, cookie, updated_at FROM site_cookies WHERE site_id = ?"
  )
    .bind(site)
    .first<CookieRow>();

  if (!row) return err("Cookie not found", 404);
  return json(row);
}

export async function POST(request: Request) {
  const env = getEnv();
  let body: { site?: string; cookie?: string } = {} as any;
  try {
    body = await request.json();
  } catch {
    return err("Invalid JSON body", 400);
  }
  if (!body.site || !body.cookie) return err("Missing required fields: site, cookie", 400);

  const ts = now();
  await env.DB.prepare(
    "INSERT OR REPLACE INTO site_cookies (site_id, cookie, updated_at) VALUES (?, ?, ?)"
  )
    .bind(body.site, body.cookie, ts)
    .run();

  return json({ site: body.site, updated_at: ts }, 201);
}
