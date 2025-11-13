import { headers } from 'next/headers';

export async function getServerOrigin(): Promise<string> {
  const h = await headers() as unknown as { get(name: string): string | null };
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost';
  const proto = h.get('x-forwarded-proto') ?? h.get('x-forwarded-protocol') ?? h.get('x-forwarded') ?? 'http';
  const serverOrigin = `${proto}://${host}`;

  return serverOrigin;
}

// Note: this file is intentionally server-only (imports next/headers). Import
// from './api.server' only in Server Components or route handlers.
