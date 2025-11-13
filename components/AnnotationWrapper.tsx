"use client";

import dynamic from 'next/dynamic';
import { useEffect, useRef } from 'react';
import { useScriptLoader, useScriptExecutionTracker, useRangeMatching } from '../hooks/AnnotationWrapper.hooks';
import Logger from './Logger';
import styles from '../styles/AnnotationWrapper.styles';
import { AnnotationContext } from '../context/Annotation.context';

const AnnotationClient = dynamic(
  () => import('./Annotation'),
  {
    ssr: false,
  }
);

type AnnotationWrapperProps = {
  scripts?: ScriptItem[];
  html: string;
  annotations?: AnnotationItem[];
  pageUrl?: string;
  title?: string;
  apiBase?: string;
}

export default function AnnotationWrapper({ scripts, html, annotations, pageUrl, title, apiBase }: AnnotationWrapperProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  useScriptLoader(scripts || [], pageUrl, apiBase);
  const { totalTime, error, success } = useScriptExecutionTracker(scripts || []);
  const { rangeResults, allMatched, annotations: matchedAnnotations } = useRangeMatching(contentRef, annotations, success);
  const contentShown = (success && allMatched)

  return (
    <>
      <div style={styles.contentContainer(contentShown)}>
        <AnnotationContext
          contentRef={contentRef as React.RefObject<HTMLDivElement>}
          initialAnnotations={matchedAnnotations}
          pageUrl={pageUrl}
          title={title}
        >
          <AnnotationClient html={html} contentRef={contentRef as React.RefObject<HTMLDivElement>} />
        </AnnotationContext>
      </div>
      {
        !contentShown && <Logger info={{ totalTime, error, rangeResults, success, title }} />
      }
    </>
  );
}