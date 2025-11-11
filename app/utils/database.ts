import { resolveApiBase } from './api';

export interface BlobListFile {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}

const BUCKET = 'annotations';

export async function getBlob(path: string, serverOrigin?: string): Promise<string | null> {
  const apiEndpoint = resolveApiBase(serverOrigin);
  if (!apiEndpoint) throw new Error('API endpoint not configured');
  const base = apiEndpoint.replace(/\/$/, '');
  const response = await fetch(`${base}/blob/get?path=${encodeURIComponent(path)}&bucket=${encodeURIComponent(BUCKET)}`, {
    cache: 'no-store'
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch blob (${response.status}): ${response.statusText}`);
  }

  return await response.text();
}

export async function uploadBlob(path: string, content: string, serverOrigin?: string): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const apiEndpoint = resolveApiBase(serverOrigin);
  if (!apiEndpoint) return { success: false, error: 'API endpoint not configured' };
  const base = apiEndpoint.replace(/\/$/, '');

  try {
    const response = await fetch(`${base}/blob/upload?path=${encodeURIComponent(path)}&bucket=${encodeURIComponent(BUCKET)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (response.ok) {
      const data = await response.json().catch(() => null);
      return { success: true, data };
    }

    const json = await response.json().catch(() => ({}));
    return { success: false, error: json.error || `HTTP ${response.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteBlob(path: string, serverOrigin?: string): Promise<{ success: boolean; error?: string }> {
  const apiEndpoint = resolveApiBase(serverOrigin);
  if (!apiEndpoint) return { success: false, error: 'API endpoint not configured' };
  const base = apiEndpoint.replace(/\/$/, '');

  try {
    const response = await fetch(`${base}/blob/delete?path=${encodeURIComponent(path)}&bucket=${encodeURIComponent(BUCKET)}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      return { success: true };
    }

    const json = await response.json().catch(() => ({}));
    return { success: false, error: json.error || `HTTP ${response.status}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listBlobs(bucket = 'annotations', type = '.json', serverOrigin?: string): Promise<BlobListFile[]> {
  const apiEndpoint = resolveApiBase(serverOrigin);
  if (!apiEndpoint) throw new Error('API endpoint not configured');
  const base = apiEndpoint.replace(/\/$/, '');
  const url = `${base}/blob/list?bucket=${encodeURIComponent(bucket)}&type=${encodeURIComponent(type)}`;
  const response = await fetch(url, {
    cache: 'no-store',
  });
  console.log('Fetched annotations from', url);

  if (!response.ok) {
    throw new Error(`Failed to list blobs: ${response.status}`);
  }

  const files = await response.json();
  return files as BlobListFile[];
}

