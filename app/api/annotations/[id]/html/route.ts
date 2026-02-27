import { getEnv } from "../../../../../utils/env";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const env = getEnv();
  const { id } = params;

  const annotation = await env.DB.prepare(
    "SELECT html FROM annotations WHERE id = ?"
  )
    .bind(id)
    .first<{ html: string | null }>();

  if (!annotation?.html)
    return new Response("Not found", { status: 404 });

  const object = await env.ANNOTATIONS_BUCKET.get(annotation.html);
  if (!object)
    return new Response("HTML content not found", { status: 404 });

  return new Response(await object.text(), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
