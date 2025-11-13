"use client";

import { useState, useEffect } from "react";
import { useAnnotationContext } from "../context/Annotator.context";

export function useFocusedId() {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const { contentRef, contentReady } = useAnnotationContext();

  // Set up interaction listeners (different for mobile vs desktop)
  useEffect(() => {
    if (!contentReady) return;
    const container = contentRef.current;
    if (!container) return;

    const handleInteraction = (e: Event) => {
      const target = e.target as Element;

      // Don't handle clicks on the menu itself
      if (target.closest('[role="toolbar"][aria-label="Highlight actions"]')) {
        return;
      }

      // Check if clicked element is a highlighted span
      if (target.matches?.('span.highlighted-text[data-highlight-id]')) {
        const span = target as HTMLSpanElement;
        const id = span.dataset.highlightId;
        if (id) {
          setFocusedId(prevId => prevId === id ? null : id); // Toggle if same span clicked
          return;
        }
      }

      // Check if clicked inside a highlighted span (for nested elements)
      const highlightedSpan = target.closest?.('span.highlighted-text[data-highlight-id]');
      if (highlightedSpan) {
        const span = highlightedSpan as HTMLSpanElement;
        const id = span.dataset.highlightId;
        if (id) {
          setFocusedId(prevId => prevId === id ? null : id); // Toggle if same span clicked
          return;
        }
      }

      // Click/touch outside any highlight - close menu
      setFocusedId(null);
    };

    // Close menu on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFocusedId(null);
      }
    };

    // Use pointerup (covers mouse and touch) so we handle the tap after
    // the gesture completes and avoid racing with focus/blur on inputs.
    container.addEventListener('pointerup', handleInteraction);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('pointerup', handleInteraction);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [contentRef, contentReady]);

  return { focusedId, setFocusedId };
}