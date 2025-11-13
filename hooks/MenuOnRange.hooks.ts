import { useEffect, useState, useCallback, useRef } from "react";
import { useMobile } from ".";
import { cleanedHtml, highlightRange, rangeToHtml } from "../utils/dom";
import { useAnnotationContext } from "../context/Annotator.context";

// Small debounce hook used to create a stable debounced callback
function useDebouncedCallback<T extends (...args: unknown[]) => void>(fn: T, delay = 100) {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => fn(...args), delay) as unknown as number;
  }, [fn, delay]);
}

export function useSelection(menuRef: React.RefObject<HTMLElement | null>) {
  const [range, setRange] = useState<Range | null>(null);
  const { isMobile } = useMobile();
  const { contentRef, addAnnotation, currentHighlightColor } = useAnnotationContext();


  // Centralized finalizer: read current selection and set range/position
  const finalizeFromSelection = useCallback((ev?: Event) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setRange(null);
      return;
    }

    const r = sel.getRangeAt(0).cloneRange();
    const container = contentRef.current;
    if (!container) {
      console.log('No container found, returning early');
      return;
    }

    const root = r.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (r.commonAncestorContainer as Element)
      : r.commonAncestorContainer.parentElement;

    if (!(root && container.contains(root))) {
      setRange(null);
      return;
    }

    // Don't show if the event target is inside the menu
    if (ev && menuRef.current && (ev.target instanceof Element) && menuRef.current.contains(ev.target)) {
      return;
    }

    setRange(r);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuRef]);

  // Debounced fallback used for selection handle drags on mobile
  const debouncedFinalize = useDebouncedCallback(finalizeFromSelection as (...args: unknown[]) => void, 100);

  // While selection is changing, hide the menu immediately
  const handleSelectionChanging = useCallback(() => {
    setRange(null);
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    // immediate path: try to finalize from the event
    finalizeFromSelection(e as Event);
  }, [finalizeFromSelection]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const target = e.target as Element;
    if (menuRef.current && menuRef.current.contains(target)) {
      return;
    }
    setRange(null);
  }, [menuRef]);

  useEffect(() => {

    document.addEventListener("pointerdown", handlePointerDown as EventListener, { capture: true });

    if (isMobile) {
      // on mobile, use debounced selectionchange to finalize selection
      document.addEventListener("selectionchange", debouncedFinalize);
      document.addEventListener("selectionchange", handleSelectionChanging);

    } else {
      // on desktop, finalize immediately on pointerup
      document.addEventListener("pointerup", handlePointerUp as EventListener, { capture: true });
    }

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown as EventListener, { capture: true });
      if (isMobile) {
        document.removeEventListener("selectionchange", debouncedFinalize);
        document.removeEventListener("selectionchange", handleSelectionChanging);

      } else {
        document.removeEventListener("pointerup", handlePointerUp as EventListener, { capture: true });
      }
    };
  }, [isMobile, handlePointerUp, handlePointerDown, debouncedFinalize, handleSelectionChanging]);


  const highlight = () => {
    if (!range) return;

    const text = range.toString();
    const { html } = cleanedHtml(rangeToHtml(range));
    addAnnotation(text, html, currentHighlightColor);

    const container = contentRef.current;
    const startEl =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
    const endEl =
      range.endContainer.nodeType === Node.ELEMENT_NODE
        ? (range.endContainer as Element)
        : range.endContainer.parentElement;
    if (!container || !startEl || !endEl || !container.contains(startEl) || !container.contains(endEl)) {
      return;
    }

    // Hide the live selection to avoid flicker while mutating DOM
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();

    highlightRange(range, currentHighlightColor);
    setRange(null);
  };

  return { range, highlight };
}

export function usePosition(menuRef: React.RefObject<HTMLElement | null>) {

}

