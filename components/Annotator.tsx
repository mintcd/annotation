"use client";

import { useRef, useCallback, useState, useEffect } from 'react';
import { useClickHref, useScriptExecutionTracker, useRangeMatching, useOptimalContentContainer } from '../hooks/Annotator.hooks';
import Logger from './Logger';
import { AnnotationContext, useAnnotationContext } from '../context/Annotator.context';
import Sidebar from './Sidebar';
import MenuOnRange from './MenuOnRange';
import MenuOnFocus from './MenuOnFocus';
import PromptBox from './PromptBox';
import annotationStyles from "../styles/Annotator.styles";

type AnnotatorProps = {
  annotations?: AnnotationItem[];
  title?: string;
  apiBase: string;
  children: React.ReactNode;
  pageUrl: string;
}

export default function Annotator({ annotations, title, apiBase, children, pageUrl }: AnnotatorProps) {
  const clonedRef = useRef<HTMLDivElement>(null);
  const { totalTime, error, success, numberOfScripts, executedScripts, kvData } = useScriptExecutionTracker(
    title,
    apiBase
  );
  const { ref: contentRef, ready: containerReady } = useOptimalContentContainer(clonedRef, success);
  const { rangeResults, allMatched, isMatching, matchedAnnotations } = useRangeMatching(
    contentRef, annotations, success,
    pageUrl,
    apiBase,
    executedScripts,
    kvData
  );


  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const closeModal = useCallback(() => setPendingHref(null), []);

  const openAnnotator = useCallback((href: string) => {
    const annotatorUrl = new URL('/annotation', window.location.origin);
    annotatorUrl.searchParams.set('url', href);
    window.open(annotatorUrl.toString(), '_blank', 'noopener');
    closeModal();
  }, [closeModal]);

  const openOriginal = useCallback((href: string) => {
    window.open(href, '_blank', 'noopener');
    closeModal();
  }, [closeModal]);

  useClickHref(clonedRef, setPendingHref);

  return (
    <>
      <div ref={clonedRef}>
        {children}
      </div>
      <AnnotationContext
        initialAnnotations={matchedAnnotations}
        title={title}
        contentReady={containerReady}
        pageUrl={pageUrl}
        contentRef={contentRef}
      >
        <Sidebar />
        <MenuOnRange />
        <MenuOnFocus />
      </AnnotationContext>

      {pendingHref && (
        <PromptBox
          message={(
            <>
              <div style={annotationStyles.promptTitle}>Open external link</div>
              <div style={annotationStyles.promptDescription}>You are about to open an external page <em>{pendingHref}</em>. Would you like to open it in the Annotator or open the original page?</div>
            </>
          )}
          actions={[
            { label: 'Annotate', action: () => openAnnotator(pendingHref), variant: 'primary' },
            { label: 'Open original', action: () => openOriginal(pendingHref), variant: 'secondary' },
            { label: 'Cancel', action: closeModal, variant: 'neutral' },
          ]}
          onClose={closeModal}
        />
      )}

      {
        (!allMatched && !isMatching) && <Logger info={{ totalTime, error, rangeResults, success, title, numberOfScripts, executedScripts }} />
      }
    </>
  );
}