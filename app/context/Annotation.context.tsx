"use client";

import { createContext, useContext, ReactNode } from "react";
import { useCallback, useState, useMemo, useEffect, useRef } from "react";
import { removeHighlights } from "../utils/dom";
import { saveAnnotationsForPage } from "../utils/annotations";

type AnnotationContextProps = {
  children: ReactNode;
  contentRef: React.RefObject<HTMLDivElement>;
  initialAnnotations?: AnnotationItem[];
  pageUrl?: string;
  title?: string;
};

type AnnotationContextType = {
  contentRef: React.RefObject<HTMLDivElement>;
  annotations: AnnotationItem[];
  pageUrl?: string;
  title?: string;
  currentHighlightColor: string;
  setCurrentHighlightColor: React.Dispatch<React.SetStateAction<string>>;
  addAnnotation: (text: string, html: string, color: string) => void;
  deleteAnnotation: (id: string) => void;
  // updateAnnotationComment: (id: string, comment: string) => void;
  // updateAnnotationColor: (id: string, color: string) => void;
  // updateAnnotationTextAndHtml: (id: string, text: string, html: string) => void;
  updateAnnotation: (params: { id: string; comment?: string; color?: string; text?: string; html?: string }) => void;
  syncStatus: 'synced' | 'syncing' | 'to-sync';
  lastAutoSaveStatus: { success: boolean; message: string } | null;
};

const AnnotationContextProvider = createContext<AnnotationContextType | null>(null);

export function useAnnotationContext(): AnnotationContextType {
  const context = useContext(AnnotationContextProvider);
  if (!context) {
    throw new Error("useAnnotationContext must be used within AnnotationContext");
  }
  return context;
}

export function useAnnotationContextOptional(): AnnotationContextType | null {
  return useContext(AnnotationContextProvider);
}

export function AnnotationContext({
  children,
  contentRef,
  initialAnnotations = [],
  pageUrl,
  title
}: AnnotationContextProps) {
  const [annotations, setAnnotations] = useState<AnnotationItem[]>(initialAnnotations);
  const [currentHighlightColor, setCurrentHighlightColor] = useState<string>("#87ceeb");
  const [lastSavedAnnotations, setLastSavedAnnotations] = useState<string>('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastAutoSaveStatus, setLastAutoSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const addAnnotation = useCallback((text: string, html: string, color: string) => {
    const id = Date.now().toString();
    const now = Date.now();
    const newAnnotation: AnnotationItem = {
      id,
      text,
      color,
      created: now,
      lastModified: now,
      html,
    };
    setAnnotations(prev => [...prev, newAnnotation]);
  }, []);

  const deleteAnnotation = useCallback((id: string) => {
    if (!contentRef.current) return;
    removeHighlights(contentRef.current, id);
    setAnnotations(prev => prev.filter((a) => a.id !== id));
  }, [contentRef]);

  const updateAnnotation = useCallback((params: { id: string; comment?: string; color?: string; text?: string; html?: string }) => {
    const { id, comment, color, text, html } = params;

    // If color is updated, also update DOM highlights immediately for UX.
    if (color !== undefined && contentRef.current) {
      const spans = contentRef.current.querySelectorAll<HTMLSpanElement>(
        `span.highlighted-text[data-highlight-id="${id}"]`
      );
      spans.forEach(span => {
        span.style.backgroundColor = color;
      });
    }

    setAnnotations(prev => prev.map(ann => {
      if (ann.id !== id) return ann;
      const updated: AnnotationItem = { ...ann, lastModified: Date.now() } as AnnotationItem;
      if (comment !== undefined) updated.comment = comment.trim() || undefined;
      if (color !== undefined) updated.color = color;
      if (text !== undefined) updated.text = text;
      if (html !== undefined) updated.html = html;
      return updated;
    }));
  }, [contentRef]);

  // const updateAnnotationComment = useCallback((id: string, comment: string) => {
  //   updateAnnotation({ id, comment });
  // }, [updateAnnotation]);

  // const updateAnnotationColor = useCallback((id: string, color: string) => {
  //   updateAnnotation({ id, color });
  // }, [updateAnnotation]);

  // const updateAnnotationTextAndHtml = useCallback((id: string, text: string, html: string) => {
  //   updateAnnotation({ id, text, html });
  // }, [updateAnnotation]);

  // Sync logic
  const saveAnnotations = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await saveAnnotationsForPage(annotations, pageUrl, title || "Annotated Page");
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, message: errorMessage };
    }
  }, [annotations, pageUrl, title]);

  // Compute current annotations hash
  const currentHash = useMemo(() => {
    return JSON.stringify(
      annotations
        .map((a) => ({
          id: a.id,
          text: a.text,
          comment: a.comment ?? null,
          color: a.color ?? null,
        }))
        .sort((a, b) => a.id.localeCompare(b.id))
    );
  }, [annotations]);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return lastSavedAnnotations !== '' && currentHash !== lastSavedAnnotations;
  }, [currentHash, lastSavedAnnotations]);

  // Mark current state as saved
  const markAsSaved = useCallback(() => {
    setLastSavedAnnotations(currentHash);
  }, [currentHash]);

  // Initialize on first mount
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      setLastSavedAnnotations(currentHash);
      hasInitialized.current = true;
    }
  }, [currentHash]);

  // Auto-save effect
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      setIsAutoSaving(true);
      try {
        const result = await saveAnnotations();
        setLastAutoSaveStatus(result);
        if (result.success) {
          markAsSaved();
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setLastAutoSaveStatus({ success: false, message: errorMessage });
      } finally {
        setIsAutoSaving(false);
      }
    }, 2000); // autoSaveDelay hardcoded to 2000ms for now

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [hasUnsavedChanges, saveAnnotations, markAsSaved]);

  // Compute syncStatus
  const syncStatus: 'synced' | 'syncing' | 'to-sync' = useMemo(() => {
    if (isAutoSaving) return 'syncing';
    if (hasUnsavedChanges) return 'to-sync';
    return 'synced';
  }, [isAutoSaving, hasUnsavedChanges]);


  const value = {
    contentRef,
    annotations,
    pageUrl,
    title,
    currentHighlightColor,
    setCurrentHighlightColor,
    addAnnotation,
    deleteAnnotation,
    updateAnnotation,
    // updateAnnotationComment,
    // updateAnnotationColor,
    // updateAnnotationTextAndHtml,
    syncStatus,
    lastAutoSaveStatus,
  };

  return (
    <AnnotationContextProvider value={value}>
      {children}
    </AnnotationContextProvider>
  );
}
