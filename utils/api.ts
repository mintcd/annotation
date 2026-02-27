/**
 * Resolve the API base URL from environment or defaults.
 * When NEXT_PUBLIC_API_ENDPOINT is unset, returns the current origin
 * (server-side via serverOrigin, client-side via window.location.origin)
 * so that API calls are same-origin.
 */
export function resolveApiBase(serverOrigin?: string): string {
  const raw = process.env.NEXT_PUBLIC_API_ENDPOINT ?? '';
  if (!raw) {
    // Same-origin: use the current origin
    if (typeof window !== 'undefined') return window.location.origin;
    if (serverOrigin) return serverOrigin;
    throw new Error("Unable to resolve API")
  }

  // Starts with :5001
  if (raw.startsWith(':')) {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.hostname}${raw}`;
    }
    // Server: if caller provided a serverOrigin use that, otherwise default to localhost as a safe fallback for dev
    if (serverOrigin) {
      try {
        // Use URL so we can replace the port rather than appending another :port
        const u = new URL(serverOrigin);
        u.port = raw.slice(1);
        return u.origin;
      } catch (e) {
        // If parsing fails, fall back to the previous behavior
        return `${serverOrigin}${raw}`;
      }
    }
    return `http://localhost${raw}`;

  }

  // Protocol-relative //host:port
  if (raw.startsWith('//')) {
    if (typeof window !== 'undefined') return `${window.location.protocol}${raw}`;
    // Server: if we have a serverOrigin prefer its protocol, otherwise default to http
    if (serverOrigin) {
      try {
        const u = new URL(serverOrigin);
        return `${u.protocol}${raw}`; // u.protocol includes trailing ':'
      } catch (e) {
        const proto = serverOrigin.split(':')[0] || 'http';
        return `${proto}:${raw}`;
      }
    }
    return `http:${raw}`;
  }

  // If the value looks like a bare hostname (no scheme, no leading // and not a port-only value)
  // assume HTTPS so consumers that use it as a base URL (e.g. new URL(path, apiBase)) get a valid origin.
  if (!raw.includes('://') && !raw.startsWith(':')) {
    try {
      const u = new URL(`https://${raw}`);
      return u.origin;
    } catch (e) {
      // Fall back to returning the raw value if parsing fails for some reason
      return raw;
    }
  }

  return raw;
}

// ===== API Client =====

/**
 * Get the API base URL
 */
const API_BASE = resolveApiBase();

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
  created_at: string;
  updated_at: string;
}

// ===== Pages API =====

/**
 * List all pages with pagination
 */
export async function listPages(limit: number = 100, offset: number = 0): Promise<Page[]> {
  const response = await fetch(
    `${API_BASE}/api/pages?limit=${limit}&offset=${offset}`
  );

  if (!response.ok) {
    throw new Error(`Failed to list pages: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a specific page by URL
 */
export async function getPage(url: string): Promise<Page | null> {
  const response = await fetch(
    `${API_BASE}/api/pages?url=${encodeURIComponent(url)}`
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to get page: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create or update a page
 */
export async function createOrUpdatePage(
  url: string,
  title: string,
  numberOfScripts: number = 0
): Promise<Page> {
  const response = await fetch(`${API_BASE}/api/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, title, number_of_scripts: numberOfScripts })
  });

  if (!response.ok) {
    throw new Error(`Failed to create page: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete a page and all its annotations
 */
export async function deletePage(url: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/pages?url=${encodeURIComponent(url)}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete page: ${response.statusText}`);
  }
}

// ===== Annotations API =====

/**
 * Get all annotations for a page
 */
export async function getAnnotationsForPage(url: string): Promise<Annotation[]> {
  const response = await fetch(
    `${API_BASE}/api/annotations?url=${encodeURIComponent(url)}`
  );

  if (!response.ok) {
    throw new Error(`Failed to get annotations: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Create a new annotation
 */
export async function createAnnotation(
  url: string,
  text: string,
  html?: string
): Promise<Annotation> {
  const response = await fetch(`${API_BASE}/api/annotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, text, html })
  });

  if (!response.ok) {
    throw new Error(`Failed to create annotation: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Update an existing annotation
 */
export async function updateAnnotation(
  id: string,
  text: string,
  html?: string
): Promise<Annotation> {
  const response = await fetch(`${API_BASE}/api/annotations/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, text, html })
  });

  if (!response.ok) {
    throw new Error(`Failed to update annotation: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete an annotation
 */
export async function deleteAnnotation(id: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/annotations?id=${id}`,
    { method: 'DELETE' }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete annotation: ${response.statusText}`);
  }
}

/**
 * Get the HTML content of an annotation
 */
export async function getAnnotationHtml(id: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/annotations/${id}/html`);

  if (!response.ok) {
    throw new Error(`Failed to get annotation HTML: ${response.statusText}`);
  }

  return response.text();
}

// ===== Helper Functions =====

/**
 * Initialize a page when user visits it
 */
export async function initializePage(url: string, title: string): Promise<Page> {
  // Check if page exists
  const existing = await getPage(url);
  if (existing) {
    return existing;
  }

  // Create new page
  return createOrUpdatePage(url, title);
}

/**
 * Get page with all its annotations
 */
export async function getPageWithAnnotations(url: string): Promise<{
  page: Page | null;
  annotations: Annotation[];
}> {
  const [page, annotations] = await Promise.all([
    getPage(url),
    getAnnotationsForPage(url)
  ]);

  return { page, annotations };
}
