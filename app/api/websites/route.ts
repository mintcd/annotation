import { getEnv } from "../../../utils/env";
import { originToSlug } from "../../../utils/url";
import { json, err, now } from "../../../utils/api-helpers";

interface Website {
  id: string;
  origin: string;
  created_at: string;
  updated_at: string;
}

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);

  const slug = url.searchParams.get("slug");
  const origin = url.searchParams.get("origin");

  if (slug) {
    const website = await env.DB.prepare(
      "SELECT * FROM websites WHERE id = ?"
    )
      .bind(slug)
      .first<Website>();
    if (!website) return err("Website not found", 404);
    return json(website);
  }

  if (origin) {
    const website = await env.DB.prepare(
      "SELECT * FROM websites WHERE origin = ?"
    )
      .bind(origin)
      .first<Website>();
    if (!website) return err("Website not found", 404);
    return json(website);
  }

  // List all websites
  const result = await env.DB.prepare(
    "SELECT * FROM websites ORDER BY created_at DESC"
  ).all<Website>();
  return json(result.results || []);
}

export async function POST(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as { origin?: string };
  if (!body.origin) return err("Missing required field: origin", 400);

  // Normalize to scheme+host only
  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(body.origin).origin;
  } catch {
    return err("Invalid origin URL", 400);
  }

  // Return early if this origin is already registered
  const existing = await env.DB.prepare(
    "SELECT * FROM websites WHERE origin = ?"
  )
    .bind(normalizedOrigin)
    .first<Website>();
  if (existing) return json(existing);

  // Compute candidate slug, resolving any collisions with a numeric suffix
  const baseSlug = originToSlug(normalizedOrigin);
  let slug = baseSlug;
  let suffix = 1;
  while (true) {
    const conflict = await env.DB.prepare(
      "SELECT id FROM websites WHERE id = ?"
    )
      .bind(slug)
      .first<{ id: string }>();
    if (!conflict) break;
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }

  const ts = now();
  const website = await env.DB.prepare(
    `INSERT INTO websites (id, origin, created_at, updated_at)
     VALUES (?, ?, ?, ?) RETURNING *`
  )
    .bind(slug, normalizedOrigin, ts, ts)
    .first<Website>();

  return json(website, 201);
}
