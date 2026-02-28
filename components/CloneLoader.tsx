"use client";

import { useEffect, useState } from "react";
import Annotator from "./Annotator";
import Loader from "./Loader";
import type { ClonedPage } from "@/utils/clone";

type Props = {
  url: string;
  annotations?: AnnotationItem[];
};

export default function CloneLoader({ url, annotations }: Props) {
  const [page, setPage] = useState<ClonedPage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPage(null);
    setError(null);

    fetch(`/api/clone?url=${encodeURIComponent(url)}`)
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e.error ?? r.statusText));
        return r.json() as Promise<ClonedPage>;
      })
      .then((data) => {
        if (!cancelled) {
          setPage(data);
          if (data.title) document.title = data.title;
        }
      })
      .catch((e) => { if (!cancelled) setError(String(e)); });

    return () => { cancelled = true; };
  }, [url]);

  if (error) {
    return (
      <div style={{ padding: "2rem", color: "red" }}>
        Failed to load page: {error}
      </div>
    );
  }

  if (!page) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <Loader />
      </div>
    );
  }

  return (
    <Annotator
      annotations={annotations}
      title={page.title}
      apiBase=""
      scripts={page.scripts}
      pageUrl={url}
    >
      <div
        className="cloned-content"
        dangerouslySetInnerHTML={{ __html: page.body }}
        suppressHydrationWarning
      />
    </Annotator>
  );
}
