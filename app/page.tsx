import Annotator from "@/components/Annotator";
import Dashboard from "@/components/Dashboard";
import { getClonedPage } from '@/utils/clone';
import { loadAnnotationsForPage } from "@/utils/annotations";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const { url } = await searchParams;
  if (!url) return { title: 'Dashboard' };


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

  const { url } = await searchParams;
  if (!url) {
    return <Dashboard />;
  }

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
