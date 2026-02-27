import Annotator from "@/components/Annotator";
import Dashboard from "@/components/Dashboard";
import { getClonedPage } from '@/utils/clone';
import { loadAnnotationsForPage } from "@/utils/annotations";
import { normalizeUrl } from "@/utils/url";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const { url: rawUrl } = await searchParams;
  if (!rawUrl) return { title: 'Dashboard' };
  const url = normalizeUrl(rawUrl);

  try {
    const { title } = await getClonedPage(url);
    return { title: title || 'Annotation Page' };
  } catch (e) {
    return { title: 'Annotation - Error loading page' };
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {

  const { url: rawUrl } = await searchParams;
  if (!rawUrl) {
    return <Dashboard />;
  }

  // Strip tracking parameters (fbclid, utm_*, etc.) so annotations are keyed
  // against the canonical URL regardless of how the page was shared.
  const url = normalizeUrl(rawUrl);

  const annotations = await loadAnnotationsForPage(url);
  const { title, favicon, body, scripts } = await getClonedPage(url);

  return (
    <Annotator
      annotations={annotations}
      title={title}
      apiBase={""}
      scripts={scripts}
      pageUrl={url}
    >
      <div className="cloned-content" dangerouslySetInnerHTML={{ __html: body }} suppressHydrationWarning />
    </Annotator>
  );
}
