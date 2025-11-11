"use client";

import React, { useCallback, useState } from "react";
import Sidebar from "./Sidebar";
import MenuOnRange from "./MenuOnRange";
import MenuOnFocus from "./MenuOnFocus";
import Content from "./Content";
import PromptBox from './PromptBox';
import { useClickHref } from '../hooks/Annotation.hooks';
import styles from "../styles/Annotation.styles";


type AnnotationProps = {
  html: string;
  contentRef: React.RefObject<HTMLDivElement>;
}

export default function Annotation({ html, contentRef }: AnnotationProps) {
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

  useClickHref(contentRef, setPendingHref);

  return (
    <>
      <Content html={html} ref={contentRef} />

      <Sidebar />
      <MenuOnRange />
      <MenuOnFocus />

      {pendingHref && (
        <PromptBox
          message={(
            <>
              <div style={styles.promptTitle}>Open external link</div>
              <div style={styles.promptDescription}>You are about to open an external page <em>{pendingHref}</em>. Would you like to open it in the Annotator or open the original page?</div>
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
    </>
  );
}


