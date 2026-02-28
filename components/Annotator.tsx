"use client";

import { useRef, useCallback, useState, useEffect, type RefObject } from 'react';
import { useClickHref, useRangeMatching } from '../hooks/Annotator.hooks';
import Logger from './Logger';
import { AnnotationContext } from '../context/Annotator.context';
import Sidebar from './Sidebar';
import MenuOnRange from './MenuOnRange';
import MenuOnFocus from './MenuOnFocus';
import PromptBox from './PromptBox';
import annotationStyles from "../styles/Annotator.styles";

type AnnotatorProps = {
  annotations?: AnnotationItem[];
  title?: string;
  apiBase: string;
  pageUrl: string;
  /** When set, renders an <iframe> pointing at this URL (same-origin frame). */
  iframeUrl: string;
}

export default function Annotator({ annotations, title, apiBase, pageUrl, iframeUrl }: AnnotatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // contentRef points to the iframe's body once it's loaded — used by range matching.
  const contentRef = useRef<HTMLElement | null>(null);
  const [iframeReady, setIframeReady] = useState(false);
  // Track the iframe element reactively so AnnotationContext children can offset positions.
  const [iframeEl, setIframeEl] = useState<HTMLIFrameElement | null>(null);

  // When the iframe finishes loading, point contentRef at its body.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      contentRef.current = iframe.contentDocument?.body ?? null;
      setIframeEl(iframe);
      setIframeReady(false);       // reset to let useRangeMatching re-run
      requestAnimationFrame(() => setIframeReady(true));
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, [iframeUrl]);

  // Forward pointer and selection events from inside the iframe to the parent document
  // so that hooks listening on `document` (MenuOnRange, etc.) receive them.
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const attach = () => {
      const iDoc = iframe.contentDocument;
      if (!iDoc) return;

      const fwd = (e: Event) => {
        try {
          document.dispatchEvent(new (e.constructor as typeof Event)(e.type, { bubbles: true, cancelable: e.cancelable }));
        } catch { /* ignore */ }
      };

      iDoc.addEventListener('pointerdown', fwd, { capture: true });
      iDoc.addEventListener('pointerup', fwd, { capture: true });
      iDoc.addEventListener('mousedown', fwd, { capture: true });
      iDoc.addEventListener('touchstart', fwd, { capture: true, passive: true });
      iDoc.addEventListener('selectionchange', fwd);

      // Store cleanup on the iframe so we can run it before re-attaching.
      (iframe as HTMLIFrameElement & { _fwdCleanup?: () => void })._fwdCleanup = () => {
        iDoc.removeEventListener('pointerdown', fwd, { capture: true });
        iDoc.removeEventListener('pointerup', fwd, { capture: true });
        iDoc.removeEventListener('mousedown', fwd, { capture: true });
        iDoc.removeEventListener('touchstart', fwd, { capture: true });
        iDoc.removeEventListener('selectionchange', fwd);
      };
    };

    const onLoad = () => {
      (iframe as HTMLIFrameElement & { _fwdCleanup?: () => void })._fwdCleanup?.();
      attach();
    };

    iframe.addEventListener('load', onLoad);
    attach(); // in case already loaded
    return () => {
      iframe.removeEventListener('load', onLoad);
      (iframe as HTMLIFrameElement & { _fwdCleanup?: () => void })._fwdCleanup?.();
    };
  }, [iframeUrl]);

  const { rangeResults, allMatched, isMatching, matchedAnnotations } = useRangeMatching(
    contentRef, annotations, iframeReady, pageUrl, apiBase
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

  useClickHref(iframeRef as RefObject<HTMLElement | null>, setPendingHref);

  return (
    <>
      <iframe
        ref={iframeRef}
        src={iframeUrl}
        style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
        title={title || 'Annotated page'}
      />
      <AnnotationContext
        initialAnnotations={matchedAnnotations}
        title={title}
        contentReady={iframeReady}
        pageUrl={pageUrl}
        contentRef={contentRef}
        iframeEl={iframeEl}
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

      {(!allMatched && !isMatching) && (
        <Logger info={{ totalTime: 0, error: null, rangeResults, success: iframeReady, title, numberOfScripts: 0, executedScripts: 0 }} />
      )}
    </>
  );
}
