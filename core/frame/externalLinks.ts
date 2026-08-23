export type ExternalLinkResolutionOptions = {
  appOrigin: string;
  sourcePageUrl?: string;
  sourceBaseUrl?: string;
  documentBaseUrl?: string;
  documentUrl?: string;
};

export const FRAME_SOURCE_BASE_META_NAME = 'annotation-source-base';

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function linkResolutionBase({
  appOrigin,
  sourcePageUrl,
  sourceBaseUrl,
  documentBaseUrl,
  documentUrl,
}: ExternalLinkResolutionOptions): string | undefined {
  const sourceBaseOrigin = originOf(sourceBaseUrl);
  if (sourceBaseUrl && sourceBaseOrigin && sourceBaseOrigin !== appOrigin) {
    return sourceBaseUrl;
  }

  const documentBaseOrigin = originOf(documentBaseUrl);
  if (documentBaseUrl && documentBaseOrigin && documentBaseOrigin !== appOrigin) {
    return documentBaseUrl;
  }
  return sourcePageUrl || documentBaseUrl || documentUrl;
}

export function resolveExternalLinkHref(
  rawHref: string | null | undefined,
  options: ExternalLinkResolutionOptions,
): string | null {
  const href = rawHref?.trim();
  if (!href || href.startsWith('#')) return null;

  const lowerHref = href.toLowerCase();
  if (lowerHref.startsWith('javascript:')) return null;

  try {
    const { appOrigin } = options;
    const base = linkResolutionBase(options);
    const linkUrl = new URL(href, base);
    if (linkUrl.protocol !== 'http:' && linkUrl.protocol !== 'https:') return null;
    if (linkUrl.origin === appOrigin) return null;
    return linkUrl.href;
  } catch {
    return null;
  }
}
