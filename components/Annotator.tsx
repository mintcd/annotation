"use client";

import { useRef, useCallback, useState, useEffect, type RefObject } from 'react';
import { useClickHref, useRangeMatching, useIframeTracking, usePostprocessIframeRef } from '../hooks/Annotator.hooks';
import { AnnotationContext } from '../context/Annotator.context';
import Sidebar from './Sidebar';
import MenuOnRange from './MenuOnRange';
import MenuOnFocus from './MenuOnFocus';
import PromptBox from './PromptBox';
import PasteHTML from './PasteHTML';
import annotationStyles from "../styles/Annotator.styles";
import Loader from './Loader';

type AnnotatorProps = {
  annotations?: AnnotationItem[];
  title?: string;
  pageUrl: string;
  iframeUrl: string;
}

export default function Annotator({ annotations, title, pageUrl, iframeUrl }: AnnotatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [showPasteHTML, setShowPasteHTML] = useState(false);

  // Parse site and path from iframeUrl: /_frame/<site>/<path...>
  const iframePathParts = iframeUrl.replace(/^\/+_frame\//, '').split('?')[0].split('/');
  const iframeSite = iframePathParts[0];
  const iframePath = iframePathParts.slice(1).join('/');

  const { iframeReady, notifyMatchSuccess, frameError, clearFrameError } = useIframeTracking(iframeRef, pageUrl);
  const { contentRef, postprocessed: iframePostprocessed, docTitle } = usePostprocessIframeRef(iframeRef, iframeReady);

  // Enforce pipeline: wait for iframe tracking and postprocessing before matching
  const effectiveReady = iframeReady && !!iframePostprocessed;
  const { rangeResults, allMatched, isMatching, matchedAnnotations } = useRangeMatching(
    contentRef, annotations, effectiveReady, pageUrl
  );

  // Write back the observed script count the first time matching fully succeeds.
  useEffect(() => {
    if (allMatched && iframeReady) {
      const iframe = iframeRef.current;
      const docTitle = iframe?.contentDocument?.title;
      console.log("Page title", docTitle);
      document.title = docTitle as string;
      notifyMatchSuccess(docTitle);
    }
  }, [allMatched, notifyMatchSuccess, iframeReady]);

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

  useClickHref(iframeRef as RefObject<HTMLElement | null>, setPendingHref);

  const handlePasteHTML = useCallback(() => setShowPasteHTML(true), []);

  return (
    <>
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
        title={title || 'Annotated page'}
      />
      {contentRef.current &&
        <AnnotationContext
          initialAnnotations={matchedAnnotations}
          title={title}
          contentReady={iframeReady}
          pageUrl={pageUrl}
          contentRef={contentRef}
          iframeRef={iframeRef}
        >
          <Sidebar onPasteHTML={handlePasteHTML} />
          <MenuOnRange />
          <MenuOnFocus />
          {showPasteHTML && (
            <PasteHTML
              error={frameError ?? undefined}
              site={iframeSite}
              path={iframePath}
              onSuccess={() => {
                setShowPasteHTML(false);
                clearFrameError();
                if (iframeRef.current) iframeRef.current.src = iframeUrl;
              }}
              onClose={() => setShowPasteHTML(false)}
            />
          )}
        </AnnotationContext>}

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

      {(!allMatched && !isMatching) && (
        <Loader />)}

      {frameError && !showPasteHTML && (
        <div style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 40, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.8rem' }}>
          Page failed to load.{' '}
          <button
            style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => setShowPasteHTML(true)}
          >
            Paste HTML
          </button>
        </div>
      )}
    </>
  );
}
