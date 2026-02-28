"use client";

import Annotator from "./Annotator";

type Props = {
  frameUrl: string;
  pageUrl: string;
  annotations?: AnnotationItem[];
  title?: string;
};

export default function CloneLoader({ frameUrl, pageUrl, annotations, title }: Props) {
  return (
    <Annotator
      annotations={annotations}
      title={title}
      apiBase=""
      pageUrl={pageUrl}
      iframeUrl={frameUrl}
    />
  );
}
