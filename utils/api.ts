export function resolveApiBase(serverOrigin?: string): string {
  const raw = process.env.NEXT_PUBLIC_API_ENDPOINT ?? '';
  if (!raw) return '';

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
