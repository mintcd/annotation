export function escapeAttrValue(value: string): string {
  const esc = (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS?.escape;
  return esc ? esc(value) : value.replace(/["\\]/g, "\\$&");
}

/**
 * Sanitize a URL to create a safe filename for blob storage
 * @param url - The URL to sanitize
 * @returns A sanitized filename safe for use in blob storage
 */
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

/**
 * Generate the full filename for annotation storage
 * @param url - The page URL
 * @returns The complete filename with path and extension
 */
export function getAnnotationFilename(url: string): string {
  const sanitizedName = sanitizeUrlForFilename(url);
  const filename = `${sanitizedName}.json`;
  return filename;
}