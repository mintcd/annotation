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

export default function Annotator({ annotations, title: titleProp, pageUrl, iframeUrl }: AnnotatorProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [title, setTitle] = useState(titleProp ?? '');
  const [frameError, setFrameError] = useState<string | null>(null);
  const [showPasteHTML, setShowPasteHTML] = useState(false);

  // Parse site and path from iframeUrl: /_frame/<site>/<path...>
  const iframePathParts = iframeUrl.replace(/^\/+_frame\//, '').split('?')[0].split('/');
  const iframeSite = iframePathParts[0];
  const iframePath = iframePathParts.slice(1).join('/');

  const { iframeReady, notifyMatchSuccess } = useIframeTracking(iframeRef, pageUrl);

  // Post-process iframe content (remove cookie banners, overlays, etc.)
  const { contentRef, postprocessed: iframePostprocessed } = usePostprocessIframeRef(iframeRef);

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
      // Read the title directly from the loaded document
      const iframeTitle = iframe.contentDocument?.title;
      if (iframeTitle) setTitle(iframeTitle);
      // Detect frame-error marker emitted by _frame/route.ts when fetch fails
      const errorMeta = iframe.contentDocument?.querySelector('meta[name="frame-error"]');
      const errMsg = errorMeta?.getAttribute('content');
      if (errMsg) {
        setFrameError(errMsg);
        setShowPasteHTML(true);
      } else {
        setFrameError(null);
      }
    };

    iframe.addEventListener('load', onLoad);
    attach(); // in case already loaded
    return () => {
      iframe.removeEventListener('load', onLoad);
      (iframe as HTMLIFrameElement & { _fwdCleanup?: () => void })._fwdCleanup?.();
    };
  }, [iframeUrl]);

  // Enforce pipeline: wait for iframe tracking and postprocessing before matching
  const effectiveReady = iframeReady && !!iframePostprocessed;
  const { rangeResults, allMatched, isMatching, matchedAnnotations } = useRangeMatching(
    contentRef, annotations, effectiveReady, pageUrl
  );

  // Write back the observed script count the first time matching fully succeeds.
  useEffect(() => {
    if (allMatched) {
      // Prefer the local `title` state, but fall back to reading the iframe's
      // document.title (in case it wasn't available earlier) and finally
      // fall back to the pageUrl so the DB always has a non-empty title.
      const iframe = iframeRef.current;
      const docTitle = iframe?.contentDocument?.title;
      const effectiveTitle = title || docTitle || pageUrl;
      notifyMatchSuccess(effectiveTitle);
    }
  }, [allMatched, notifyMatchSuccess, title]);

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
      {contentRef.current &&
        <AnnotationContext
          initialAnnotations={matchedAnnotations}
          title={title}
          contentReady={iframeReady}
          pageUrl={pageUrl}
          contentRef={contentRef}
          onPasteHTML={() => setShowPasteHTML(true)}
        >
          <Sidebar />
          <MenuOnRange />
          <MenuOnFocus />
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

      {showPasteHTML && frameError && (
        <PasteHTML
          error={frameError}
          site={iframeSite}
          path={iframePath}
          onSuccess={() => {
            setShowPasteHTML(false);
            setFrameError(null);
            if (iframeRef.current) iframeRef.current.src = iframeUrl;
          }}
          onClose={() => setShowPasteHTML(false)}
        />
      )}

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
