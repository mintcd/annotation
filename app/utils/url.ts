
export function sanitizeUrlForFilename(url: string): string {
  // Try multiple decoding approaches
  let decodedUrl = url;
  try {
    decodedUrl = decodeURIComponent(url);
    // console.log('[URLSanitizer] Decoding successful:', { decoded: decodedUrl });
  } catch (e) {
    // console.log('[URLSanitizer] Decoding failed, using original:', e);
  }

  // Step-by-step transformation with logging
  const step1 = decodedUrl.replace(/^https?:\/\//, '');
  // console.log('[URLSanitizer] After protocol removal:', step1);

  const step2 = step1.replace(/[^a-z0-9/]/gi, '_');
  // console.log('[URLSanitizer] After non-alphanumeric replacement (keeping /):', step2);

  const step3 = step2.replace(/_+/g, '_');
  // console.log('[URLSanitizer] After underscore consolidation:', step3);

  const step4 = step3.replace(/\/+/g, '/');
  // console.log('[URLSanitizer] After slash consolidation:', step4);

  const step5 = step4.replace(/^[_/]|[_/]$/g, '');
  // console.log('[URLSanitizer] After trimming:', step5);

  const result = step5.toLowerCase();
  return result;
}

export function getAnnotationFilename(url: string): string {
  const sanitizedName = sanitizeUrlForFilename(url);
  const filename = `${sanitizedName}.json`;
  return filename;
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove trailing slash from pathname if present
    u.pathname = u.pathname.replace(/\/$/, '') || '/';
    return u.href;
  } catch {
    return url; // fallback for invalid URLs
  }
};
