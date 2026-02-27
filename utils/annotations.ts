import { listPages, getAnnotationsForPage, Page, Annotation } from './database';


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
      return annotations
    // Query DOM for order
    // const spans = document.querySelectorAll<HTMLSpanElement>('span.highlighted-text[data-highlight-id]');
    // const orderMap = new Map<string, number>();
    // spans.forEach((span, index) => {
    //   const id = span.getAttribute('data-highlight-id');
    //   if (id) orderMap.set(id, index);
    // });
    // return [...annotations].sort((a, b) => {
    //   const aOrder = orderMap.get(a.id) ?? Infinity;
    //   const bOrder = orderMap.get(b.id) ?? Infinity;
    //   return aOrder - bOrder;
    // });
  }
}

export const sortOptions = [
  { value: 'dom-order' as SortOption, label: 'Page Order' },
  { value: 'created-desc' as SortOption, label: 'Newest First' },
  { value: 'created-asc' as SortOption, label: 'Oldest First' },
  { value: 'modified-desc' as SortOption, label: 'Recently Modified' },
  { value: 'modified-asc' as SortOption, label: 'Least Recently Modified' },
];

export type AnnotationPage = {
  url: string;
  filename: string;
  timestamp: string;
  title?: string;
  count: number;
  annotations: AnnotationItem[];
  blobUrl: string;
  uploadedAt: string;
}

// Convert database Annotation to AnnotationItem
function convertToAnnotationItem(annotation: Annotation): AnnotationItem {
  return {
    id: annotation.id,
    text: annotation.text,
    html: annotation.html || undefined, // Include the html field (actual HTML content from API)
    color: annotation.color || '#87ceeb', // Use color from database or default
    comment: annotation.comment || undefined, // Include comment if present
    created: new Date(annotation.created_at).getTime(),
    lastModified: new Date(annotation.updated_at).getTime(),
  };
}

export async function loadAnnotations(): Promise<AnnotationPage[]> {
  try {
    const pages: Page[] = await listPages();

    const annotationPages: AnnotationPage[] = [];

    for (const page of pages) {
      try {
        const annotations = await getAnnotationsForPage(page.url);

        annotationPages.push({
          url: page.url,
          filename: `${page.id}.json`, // Not really used anymore but kept for compatibility
          timestamp: page.created_at,
          title: page.title,
          count: page.number_of_annotations,
          annotations: annotations.map(convertToAnnotationItem),
          blobUrl: '', // Not used anymore
          uploadedAt: page.updated_at
        });
      } catch (error) {
        console.error(`Error processing page ${page.url}:`, error);
        // Continue with other pages
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


export async function loadAnnotationsForPage(pageUrl: string): Promise<AnnotationItem[]> {
  try {
    const annotations = await getAnnotationsForPage(pageUrl);

    if (!annotations || annotations.length === 0) {
      // No annotations exist yet - this is expected on first visit
      return [];
    }
    console.log(annotations)
    console.log(`Loaded ${annotations.length} annotations for ${pageUrl}`);
    return annotations.map(convertToAnnotationItem);
  } catch (error) {
    // Check if it's a 404 (no annotations yet) vs a real error
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('404')) {
      // No annotations exist yet - silently return empty array
      return [];
    }
    // Log other errors that might indicate real problems
    console.error('Error loading annotations:', error);
    return [];
  }
}

// Note: saveAnnotationsForPage is now handled differently
// The client should directly call createAnnotation/updateAnnotation/deleteAnnotation
// from database.ts instead of saving the entire annotation array


