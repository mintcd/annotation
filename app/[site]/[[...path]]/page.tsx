import CloneLoader from "@/components/CloneLoader";
import { loadAnnotationsForPage } from "@/utils/annotations";
import { normalizeUrl, appPathToPageUrl } from "@/utils/url";
import { getWebsiteBySlug } from "@/utils/database";
import { notFound } from "next/navigation";

type Params = { site: string; path?: string[] };
type SearchParams = Record<string, string | string[] | undefined>;

/** Re-serialize Next.js searchParams as a query string. */
function buildSearch(sp: SearchParams): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) v.forEach((val) => params.append(k, val));
    else if (v !== undefined) params.set(k, v);
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { site, path } = await params;
  const search = buildSearch(await searchParams);

  const website = await getWebsiteBySlug(site);
  if (!website) return { title: "Not Found" };

  // Don't call getClonedPage here — it causes Next.js/vinext to hoist every
  // <link> element from the cloned HTML into the RSC stream as resource hints,
  // producing "<link rel=preload> must have a valid `as` value" warnings.
  // CloneLoader will update document.title once it loads client-side.
  const url = normalizeUrl(appPathToPageUrl(website.origin, path, search));
  const hostname = new URL(url).hostname.replace(/^www\./, '');
  return { title: `Annotating ${hostname}` };
}

export default async function SitePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { site, path } = await params;
  const search = buildSearch(await searchParams);

  const website = await getWebsiteBySlug(site);
  if (!website) notFound();

  // Reconstruct the original URL and strip tracking params
  const url = normalizeUrl(appPathToPageUrl(website.origin, path, search));

  // Build the same-origin frame URL served by /_frame/{slug}/...
  const framePathname = path?.length ? path.join('/') : '';
  const frameUrl = `/_frame/${site}${framePathname ? '/' + framePathname : ''}${search}`;

  const annotations = await loadAnnotationsForPage(url);

  return <CloneLoader frameUrl={frameUrl} pageUrl={url} annotations={annotations} />;
}
