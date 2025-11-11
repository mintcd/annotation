import AnnotationWrapper from "./components/AnnotationWrapper";
import { loadAnnotationsForPage, loadAnnotations } from "./utils/annotations";
import { resolveApiBase } from './utils/api';
import Dashboard from "./components/Dashboard";
import { getClonedPage } from './utils/clone';
import { getServerOrigin } from "./utils/api.server";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const { url } = await searchParams;
  if (!url) return { title: 'Dashboard' };

  const serverOrigin = await getServerOrigin();
  const apiBase = resolveApiBase(serverOrigin);

  try {
    const { title } = await getClonedPage(apiBase, url);
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
  const serverOrigin = await getServerOrigin();
  const apiBase = resolveApiBase(serverOrigin);
  console.log('API Base URL:', apiBase);
  const { url } = await searchParams;
  if (!url) {

    const annotationPages = await loadAnnotations(serverOrigin);
    return <Dashboard annotationPages={annotationPages} />;
  }

  const annotations = await loadAnnotationsForPage(apiBase, url);
  const { title, favicon, body, scripts } = await getClonedPage(apiBase, url);

  return (
    <AnnotationWrapper
      html={body}
      annotations={annotations}
      scripts={scripts}
      pageUrl={url}
      title={title}
      apiBase={apiBase}
    />
  );
}
