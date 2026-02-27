
// On the client, relative URLs work fine.
// On the server (Cloudflare Worker), fetch() requires absolute URLs;
// worker/index.ts stores the request origin on globalThis.__origin.
function getBase(): string {
  if (typeof window !== 'undefined') return '';
  return globalThis.__origin ?? '';
}

export interface Page {
  id: string;
  url: string;
  title: string;
  number_of_scripts: number;
  number_of_annotations: number;
  created_at: string;
  updated_at: string;
}

export interface Annotation {
  id: string;
  page_id: string;
  text: string;
  html: string | null;
  color: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

// ===== Pages API =====

export async function listPages(): Promise<Page[]> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to list pages: ${response.status}`);
  }

  return await response.json();
}

export async function getPage(url: string): Promise<Page | null> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages?url=${encodeURIComponent(url)}`, {
    cache: 'no-store'
  });

  if (response.status === 404) return null;

  if (!response.ok) {
    throw new Error(`Failed to get page: ${response.status}`);
  }

  return await response.json();
}

export async function createOrUpdatePage(
  url: string,
  title: string,
  numberOfScripts: number = 0,
): Promise<Page> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title, number_of_scripts: numberOfScripts })
  });

  if (!response.ok) {
    throw new Error(`Failed to create page: ${response.status}`);
  }

  return await response.json();
}

export async function deletePage(url: string): Promise<void> {
  const base = getBase();
  const response = await fetch(`${base}/api/pages?url=${encodeURIComponent(url)}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error(`Failed to delete page: ${response.status}`);
  }
}

// ===== Annotations API =====

export async function getAnnotationsForPage(url: string): Promise<Annotation[]> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations?url=${encodeURIComponent(url)}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to get annotations: ${response.status}`);
  }

  return await response.json();
}

export async function createAnnotation(
  url: string,
  text: string,
  html?: string,
  color?: string,
  comment?: string,
): Promise<Annotation> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, text, html, color, comment })
  });

  if (!response.ok) {
    throw new Error(`Failed to create annotation: ${response.status}`);
  }

  return await response.json();
}

export async function updateAnnotation(
  id: string,
  text?: string,
  html?: string,
  color?: string,
  comment?: string,
): Promise<Annotation> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, text, html, color, comment })
  });

  if (!response.ok) {
    throw new Error(`Failed to update annotation: ${response.status}`);
  }

  return await response.json();
}

export async function deleteAnnotation(id: string): Promise<void> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations?id=${id}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error(`Failed to delete annotation: ${response.status}`);
  }
}

export async function getAnnotationHtml(id: string): Promise<string> {
  const base = getBase();
  const response = await fetch(`${base}/api/annotations/${id}/html`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to get annotation HTML: ${response.status}`);
  }

  return await response.text();
}

