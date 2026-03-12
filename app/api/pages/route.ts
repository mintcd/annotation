import { getEnv } from "../../../utils/env";
import {
  type Page,
  generatePageId,
  now,
  json,
  err,
} from "../../../utils/api-helpers";

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);

  const pageUrl = url.searchParams.get("url");
  if (pageUrl) {
    const id = await generatePageId(pageUrl);
    const page = await env.DB.prepare("SELECT * FROM pages WHERE id = ?")
      .bind(id)
      .first<Page>();
    if (!page) return err("Page not found", 404);
    return json(page);
  }

  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const result = await env.DB.prepare(
    "SELECT * FROM pages ORDER BY updated_at DESC LIMIT ? OFFSET ?"
  )
    .bind(limit, offset)
    .all<Page>();
  return json(result.results || []);
}

export async function POST(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as {
    url?: string;
    title?: string;
    number_of_scripts?: number;
  };
  if (!body.url) return err("Missing required field: url", 400);

  const title = body.title ?? '';

  const id = await generatePageId(body.url);
  const ts = now();
  const page = await env.DB.prepare(
    `INSERT INTO pages (id, url, title, number_of_scripts, number_of_annotations, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       number_of_scripts = excluded.number_of_scripts,
       updated_at = excluded.updated_at
     RETURNING *`
  )
    .bind(id, body.url, title, body.number_of_scripts || 0, ts, ts)
    .first<Page>();
  return json(page);
}

export async function DELETE(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const pageUrl = url.searchParams.get("url");
  if (!pageUrl) return err("Missing required parameter: url", 400);
  const id = await generatePageId(pageUrl);

  // Delete associated annotation HTML from R2
  const annotations = await env.DB.prepare(
    "SELECT id, html FROM annotations WHERE page_id = ?"
  )
    .bind(id)
    .all<{ id: string; html: string | null }>();
  for (const a of annotations.results || []) {
    if (a.html) {
      try {
        await env.ANNOTATIONS_BUCKET.delete(a.html);
      } catch { }
    }
  }

  // Delete annotations then page
  await env.DB.prepare("DELETE FROM annotations WHERE page_id = ?")
    .bind(id)
    .run();
  await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(id).run();
  return json({ success: true, message: "Page deleted successfully" });
}

export async function PUT(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as {
    url?: string;
    title?: string;
    number_of_scripts?: number;
  };
  if (!body.url) return err("Missing required field: url", 400);

  const id = await generatePageId(body.url);
  const ts = now();

  // Only update existing pages; do not create new pages here.
  const updated = await env.DB.prepare(
    `UPDATE pages SET
       title = COALESCE(?, title),
       number_of_scripts = COALESCE(?, number_of_scripts),
       updated_at = ?
     WHERE id = ?
     RETURNING *`
  )
    .bind(body.title ?? null, body.number_of_scripts ?? null, ts, id)
    .first<Page>();

  if (!updated) return err("Page not found", 404);
  return json(updated);
}