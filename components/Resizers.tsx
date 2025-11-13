import { useState, useEffect, useCallback, useRef } from 'react';
import sticksStyles from '../styles/Sticks.styles';
import { useAnnotationContext } from '../context/Annotation.context';
import { highlightStartPosition, highlightEndPosition } from '../utils/highlight';

type Props = {
  annotationId: string;
}

const STICK_WIDTH = 1.5

export default function Sticks({ annotationId }: Props) {
  const [dragging, setDragging] = useState<'start' | 'end' | null>(null);
  // during drag we store the visual position of the moving stick as a DOMRect
  const [draggingRect, setDraggingRect] = useState<DOMRect | null>(null);
  const { contentRef } = useAnnotationContext();

  // Hide sticks while the user is scrolling or sliding (touchmove/wheel)
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  const startRect = highlightStartPosition(annotationId);
  const endRect = highlightEndPosition(annotationId);

  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'start' | 'end') => {
    e.preventDefault();
    setDragging(type);
    // prevent text selection while dragging
    document.body.style.userSelect = 'none';

    // initialize dragging rect to the current stick position so it doesn't jump
    try {
      if (type === 'start') {
        const sr = highlightStartPosition(annotationId);
        if (sr) setDraggingRect(new DOMRect(sr.left, sr.top, sr.width, sr.height));
      } else {
        const er = highlightEndPosition(annotationId);
        if (er) setDraggingRect(new DOMRect(er.left, er.top, er.width, er.height));
      }
    } catch (err) {
      // ignore
    }
  }, [annotationId]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !contentRef.current) return;

    // cross-browser caret range from point
    const getRangeAtPoint = (x: number, y: number): Range | null => {
      const doc = document as unknown as {
        caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
        caretRangeFromPoint?: (x: number, y: number) => Range | null;
      };
      if (doc.caretPositionFromPoint) {
        try {
          const pos = doc.caretPositionFromPoint(x, y);
          if (!pos) return null;
          const r = document.createRange();
          r.setStart(pos.offsetNode, pos.offset);
          r.setEnd(pos.offsetNode, pos.offset);
          return r;
        } catch (err) {
          return null;
        }
      }
      if (doc.caretRangeFromPoint) {
        try {
          return doc.caretRangeFromPoint(x, y);
        } catch (err) {
          return null;
        }
      }
      return null;
    };

    const isInAnnotationSpan = (node: Node | null) => {
      if (!node) return false;
      let el: Node | null = node;
      while (el && el.nodeType === Node.TEXT_NODE) el = el.parentNode;
      if (!el || !(el as Element).closest) return false;
      return !!(el as Element).closest(`span.highlighted-text[data-highlight-id="${annotationId}"]`);
    };

    // Try direct caret lookup first
    let caret = getRangeAtPoint(e.clientX, e.clientY);

    // If caret not inside the annotation, fallback to nearest highlighted span
    if (!caret || !isInAnnotationSpan(caret.startContainer)) {
      const spans = Array.from(document.querySelectorAll<HTMLSpanElement>(`span.highlighted-text[data-highlight-id="${annotationId}"]`));
      if (spans.length === 0) return;

      const x = e.clientX;
      const y = e.clientY;
      let chosen: HTMLSpanElement | null = null;
      for (const s of spans) {
        const r = s.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          chosen = s;
          break;
        }
      }

      if (!chosen) {
        let bestDist = Infinity;
        for (const s of spans) {
          const r = s.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const dist = Math.hypot(cx - x, cy - y);
          if (dist < bestDist) {
            bestDist = dist;
            chosen = s;
          }
        }
      }

      if (!chosen) return;

      const chosenRect = chosen.getBoundingClientRect();
      const clampX = Math.min(Math.max(e.clientX, chosenRect.left + 1), chosenRect.right - 1);
      caret = getRangeAtPoint(clampX, e.clientY) || getRangeAtPoint(clampX, chosenRect.top + 2) || getRangeAtPoint(clampX, chosenRect.bottom - 2);
      if (!caret) return;
    }

    // At this point caret should be set and (ideally) inside the annotation. Compute its visual rect.
    try {
      let caretRect: DOMRect | null = null;
      const clientRects = (caret as Range).getClientRects();
      if (clientRects && clientRects.length > 0) {
        const r = clientRects[0];
        caretRect = new DOMRect(r.left, r.top, r.width, r.height);
      } else {
        const br = (caret as Range).getBoundingClientRect();
        if (br && (br.width || br.height)) caretRect = new DOMRect(br.left, br.top, br.width, br.height);
      }
      if (caretRect) setDraggingRect(caretRect);
    } catch (err) {
      // ignore
    }
  }, [dragging, contentRef, annotationId]);

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;

    // restore user-select
    document.body.style.userSelect = '';

    // Only update visual state; do NOT change highlights here.
    setDragging(null);
    setDraggingRect(null);
  }, [dragging]);

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, handleMouseMove, handleMouseUp]);

  // Hide sticks while scrolling or sliding (touchmove / wheel). Re-show after debounce.
  useEffect(() => {
    const onScrollStart = () => {
      // mark hidden
      setHiddenOnScroll(true);
      // clear previous timeout
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      // set timeout to clear hidden after 150ms of no scroll events
      scrollTimeoutRef.current = window.setTimeout(() => {
        setHiddenOnScroll(false);
        scrollTimeoutRef.current = null;
      }, 150) as unknown as number;
    };

    // Attach handlers to container (if provided) and to document/window as fallback
    const container = contentRef?.current ?? null;
    const opts: AddEventListenerOptions = { passive: true };

    if (container) {
      container.addEventListener('scroll', onScrollStart, opts);
      container.addEventListener('touchmove', onScrollStart, opts);
    }

    document.addEventListener('scroll', onScrollStart, { passive: true, capture: true });
    window.addEventListener('wheel', onScrollStart, { passive: true });
    window.addEventListener('touchmove', onScrollStart, { passive: true });

    return () => {
      if (container) {
        container.removeEventListener('scroll', onScrollStart, opts);
        container.removeEventListener('touchmove', onScrollStart, opts);
      }
      // remove with matching capture boolean
      document.removeEventListener('scroll', onScrollStart, true);
      window.removeEventListener('wheel', onScrollStart);
      window.removeEventListener('touchmove', onScrollStart);
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = null;
      }
    };
  }, [contentRef]);

  if (!startRect || !endRect || startRect.width === 0 || endRect.width === 0) return <></>;

  // Hide sticks while scrolling/sliding
  if (hiddenOnScroll) return <></>;

  const displayStart = (dragging === 'start' && draggingRect)
    ? { top: draggingRect.top, left: draggingRect.left, right: draggingRect.left + draggingRect.width, height: draggingRect.height, width: draggingRect.width }
    : startRect;

  const displayEnd = (dragging === 'end' && draggingRect)
    ? { top: draggingRect.top, left: draggingRect.left, right: draggingRect.left + draggingRect.width, height: draggingRect.height, width: draggingRect.width }
    : endRect;

  return (
    <>
      {/* Start Stick (only top knob) */}
      <div
        className='start-stick'
        style={sticksStyles.stick(
          displayStart.top,
          displayStart.left - STICK_WIDTH,
          displayStart.height,
          STICK_WIDTH
        )}
        onMouseDown={(e) => handleMouseDown(e, 'start')}
      >
        <div style={sticksStyles.knob('top', STICK_WIDTH)} />
      </div>
      {/* End Stick */}
      <div
        className='end-stick'
        style={sticksStyles.stick(
          displayEnd.top,
          displayEnd.right,
          displayEnd.height,
          STICK_WIDTH
        )}
        onMouseDown={(e) => handleMouseDown(e, 'end')}
      >
        <div style={sticksStyles.knob('bottom', STICK_WIDTH)} />
      </div>
    </>
  )
}
