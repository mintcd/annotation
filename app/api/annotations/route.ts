import { getEnv } from "../../../utils/env";
import {
  type Annotation,
  generatePageId,
  now,
  json,
  err,
} from "../../../utils/api-helpers";

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);

  // GET /api/annotations?url=...
  const pageUrl = url.searchParams.get("url");
  if (!pageUrl) return err("Missing required parameter: url", 400);
  const pageId = await generatePageId(pageUrl);
  const result = await env.DB.prepare(
    "SELECT * FROM annotations WHERE page_id = ? ORDER BY created_at ASC"
  )
    .bind(pageId)
    .all<Annotation>();

  // Fetch HTML content from R2 for each annotation
  const annotations = await Promise.all(
    (result.results || []).map(async (a: Annotation) => {
      if (a.html) {
        try {
          const obj = await env.ANNOTATIONS_BUCKET.get(a.html);
          return { ...a, html: obj ? await obj.text() : null };
        } catch {
          return { ...a, html: null };
        }
      }
      return a;
    })
  );
  return json(annotations);
}

export async function POST(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as {
    url?: string;
    text?: string;
    html?: string;
    color?: string;
    comment?: string;
  };
  if (!body.url || !body.text)
    return err("Missing required fields: url, text", 400);

  const pageId = await generatePageId(body.url);
  const id = Date.now().toString();
  const ts = now();

  const annotation = await env.DB.prepare(
    `INSERT INTO annotations (id, page_id, text, html, color, comment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(
      id,
      pageId,
      body.text,
      null,
      body.color || "#87ceeb",
      body.comment || null,
      ts,
      ts
    )
    .first<Annotation>();

  let returnAnnotation = annotation!;
  let htmlContent = body.html ?? null;

  // Upload HTML to R2 if provided
  if (body.html) {
    const htmlPath = `${id}.html`;
    await env.ANNOTATIONS_BUCKET.put(htmlPath, body.html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
    // Update annotation with HTML reference
    returnAnnotation = (await env.DB.prepare(
      "UPDATE annotations SET html = ?, updated_at = ? WHERE id = ? RETURNING *"
    )
      .bind(htmlPath, ts, id)
      .first<Annotation>())!;
  }

  // Update page annotation count
  await env.DB.prepare(
    `UPDATE pages SET number_of_annotations = number_of_annotations + 1, updated_at = ? WHERE id = ?`
  )
    .bind(ts, pageId)
    .run();

  return json({ ...returnAnnotation, html: htmlContent });
}

export async function PUT(request: Request) {
  const env = getEnv();
  const body = (await request.json()) as {
    id?: string;
    text?: string;
    html?: string;
    color?: string;
    comment?: string;
  };
  if (!body.id) return err("Missing required field: id", 400);

  const existing = await env.DB.prepare(
    "SELECT * FROM annotations WHERE id = ?"
  )
    .bind(body.id)
    .first<Annotation>();
  if (!existing) return err("Annotation not found", 404);

  let htmlPath = existing.html;

  // Update HTML in R2 if provided
  if (body.html !== undefined) {
    htmlPath = `${body.id}.html`;
    await env.ANNOTATIONS_BUCKET.put(htmlPath, body.html, {
      httpMetadata: { contentType: "text/html; charset=utf-8" },
    });
  }

  // Build dynamic update
  const updates: string[] = [];
  const values: unknown[] = [];
  if (body.text !== undefined) {
    updates.push("text = ?");
    values.push(body.text);
  }
  if (htmlPath !== undefined) {
    updates.push("html = ?");
    values.push(htmlPath);
  }
  if (body.color !== undefined) {
    updates.push("color = ?");
    values.push(body.color);
  }
  if (body.comment !== undefined) {
    updates.push("comment = ?");
    values.push(body.comment);
  }
  const ts = now();
  updates.push("updated_at = ?");
  values.push(ts);
  values.push(body.id);

  const updated = await env.DB.prepare(
    `UPDATE annotations SET ${updates.join(", ")} WHERE id = ? RETURNING *`
  )
    .bind(...values)
    .first<Annotation>();

  // Fetch HTML content for response
  let htmlContent: string | null = null;
  if (updated?.html) {
    try {
      const obj = await env.ANNOTATIONS_BUCKET.get(updated.html);
      htmlContent = obj ? await obj.text() : null;
    } catch { }
  }

  return json({ ...updated, html: htmlContent });
}

export async function DELETE(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const annotationId = url.searchParams.get("id");
  if (!annotationId) return err("Missing required parameter: id", 400);

  const annotation = await env.DB.prepare(
    "SELECT * FROM annotations WHERE id = ?"
  )
    .bind(annotationId)
    .first<Annotation>();

  if (annotation) {
    if (annotation.html) {
      try {
        await env.ANNOTATIONS_BUCKET.delete(annotation.html);
      } catch { }
    }
    await env.DB.prepare(
      `UPDATE pages SET number_of_annotations = number_of_annotations - 1, updated_at = ? WHERE id = ?`
    )
      .bind(now(), annotation.page_id)
      .run();
  }

  await env.DB.prepare("DELETE FROM annotations WHERE id = ?")
    .bind(annotationId)
    .run();
  return json({
    success: true,
    message: "Annotation deleted successfully",
  });
}
