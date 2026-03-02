import { getEnv } from '@/utils/env';

/**
 * POST /api/webpages
 * Body: { site: string; path: string; html: string }
 * Stores the HTML in the WEBPAGES_BUCKET R2 bucket under key `${site}/${path}`.
 */
export async function POST(request: Request) {
  let body: { site?: string; path?: string; html?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { site, path, html } = body;
  if (!site || !html) {
    return Response.json({ error: 'Missing required fields: site, html' }, { status: 400 });
  }

  const key = path ? `${site}/${path}` : site;

  try {
    const env = getEnv();
    await env.WEBPAGES_BUCKET.put(key, html, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
    });
  } catch {
    return Response.json({ error: 'Storage unavailable' }, { status: 503 });
  }

  return Response.json({ ok: true, key });
}
