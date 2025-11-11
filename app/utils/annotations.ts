import { getAnnotationFilename } from './string';
import { getBlob, uploadBlob, listBlobs } from './database';


export type SortOption = 'created-asc' | 'created-desc' | 'modified-asc' | 'modified-desc' | 'dom-order';

export function sortAnnotations(annotations: AnnotationItem[], sortOption: SortOption): AnnotationItem[] {
  switch (sortOption) {
    case 'created-asc':
      return [...annotations].sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
    case 'created-desc':
      return [...annotations].sort((a, b) => (b.created ?? 0) - (a.created ?? 0));
    case 'modified-asc':
      return [...annotations].sort((a, b) => (a.lastModified ?? 0) - (b.lastModified ?? 0));
    case 'modified-desc':
      return [...annotations].sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
    case 'dom-order':
    default:
      // Query DOM for order
      const spans = document.querySelectorAll<HTMLSpanElement>('span.highlighted-text[data-highlight-id]');
      const orderMap = new Map<string, number>();
      spans.forEach((span, index) => {
        const id = span.getAttribute('data-highlight-id');
        if (id) orderMap.set(id, index);
      });
      return [...annotations].sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? Infinity;
        const bOrder = orderMap.get(b.id) ?? Infinity;
        return aOrder - bOrder;
      });
  }
}

export const sortOptions = [
  { value: 'dom-order' as SortOption, label: 'Page Order' },
  { value: 'created-desc' as SortOption, label: 'Newest First' },
  { value: 'created-asc' as SortOption, label: 'Oldest First' },
  { value: 'modified-desc' as SortOption, label: 'Recently Modified' },
  { value: 'modified-asc' as SortOption, label: 'Least Recently Modified' },
];


type BlobFile = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
}


type AnnotationPage = {
  url: string;
  filename: string;
  timestamp: string;
  title?: string;
  count: number;
  annotations: AnnotationItem[];
  blobUrl: string;
  uploadedAt: string;
}

export async function loadAnnotations(serverOrigin?: string): Promise<AnnotationPage[]> {
  try {
    const blobFiles: BlobFile[] = await listBlobs('annotations', '.json', serverOrigin);

    const annotationPages: AnnotationPage[] = [];

    for (const file of blobFiles) {
      try {
        let jsonString: string | null = null;
        try {
          jsonString = await getBlob(file.pathname, serverOrigin);
        } catch (e) {
          try {
            const r = await fetch(file.url, { cache: 'no-store' });
            if (!r.ok) {
              console.error(`Failed to fetch ${file.pathname}: ${r.status}`);
              continue;
            }
            jsonString = await r.text();
          } catch (ee) {
            console.error(`Failed to fetch ${file.pathname}:`, ee);
            continue;
          }
        }
        if (!jsonString) {
          console.error(`No content for ${file.pathname}`);
          continue;
        }

        const data = JSON.parse(jsonString);
        const metadata = data.metadata || {};
        const annotations = data.annotations || data;
        const title = data.title || undefined;

        if (!Array.isArray(annotations)) {
          console.error(`Invalid data for ${file.pathname}: annotations should be an array`);
          continue;
        }

        annotationPages.push({
          url: metadata.url || '',
          filename: file.pathname,
          timestamp: metadata.timestamp || '',
          title,
          count: metadata.count || annotations.length,
          annotations,
          blobUrl: file.url,
          uploadedAt: file.uploadedAt
        });
      } catch (error) {
        console.error(`Error processing ${file.pathname}:`, error);
        // Continue with other files
      }
    }

    console.log(`Fetched ${annotationPages.length} pages`);

    annotationPages.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );

    return annotationPages;
  } catch (error) {
    console.error('[Dashboard] Error fetching annotations:', error);
    return [];
  }
}


export async function loadAnnotationsForPage(serverOrigin: string, pageUrl: string): Promise<AnnotationItem[]> {
  try {
    const filename = getAnnotationFilename(pageUrl);
    const jsonString = await getBlob(filename, serverOrigin);
    if (jsonString === null) {
      console.log(`No annotations found for ${pageUrl}`);
      return [];
    }

    const data = JSON.parse(jsonString);
    const annotations = data.annotations || data;

    if (!Array.isArray(annotations)) {
      console.error(`Invalid data for ${pageUrl}: annotations should be an array`);
      return [];
    }

    console.log(`Loaded ${annotations.length} annotations from ${filename}`);

    return annotations;
  } catch (error) {
    console.error('Error loading annotations:', error);
    // Return empty array instead of throwing to allow page to render
    return [];
  }
}


export async function saveAnnotationsForPage(currentAnnotations: AnnotationItem[], currentPageUrl?: string, currentTitle?: string): Promise<{ success: boolean; message: string }> {
  if (!currentPageUrl) {
    return { success: false, message: 'Page URL is required for export' };
  }

  const filename = getAnnotationFilename(currentPageUrl);
  console.log(`Saving ${currentAnnotations.length} annotations to ${filename}...`);

  // Save top-level title for dashboard, and keep metadata for backwards compatibility
  const annotationData = {
    title: currentTitle || '',
    metadata: {
      url: currentPageUrl,
      timestamp: new Date().toISOString(),
      count: currentAnnotations.length
    },
    annotations: currentAnnotations
  };

  const annotationsJSON = JSON.stringify(annotationData, null, 2);

  try {
    const res = await uploadBlob(filename, annotationsJSON);
    if (res.success) {
      console.log(res.data);
      return {
        success: true,
        message: `Successfully saved ${currentAnnotations.length} annotation${currentAnnotations.length !== 1 ? 's' : ''} to ${filename}!`
      };
    }

    return { success: false, message: res.error || 'Unknown error' };
  } catch (error) {
    console.error('Save error:', error);
    return {
      success: false,
      message: `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

