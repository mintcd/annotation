import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import React from 'react';


type UseResizeConfig = {
  initialWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
  disabled?: boolean;
  elementRef?: React.RefObject<HTMLElement>;
};

type UseResizeReturn = {
  width: number;
  // Optional React pointer handler to attach to a handle element
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  // Expose setter for programmatic width changes
  setWidth?: (w: number) => void;
};

export function useResize({
  initialWidth = 320,
  minWidth = 240,
  maxWidth = 560,
  storageKey,
  disabled = false,
  elementRef,
}: UseResizeConfig = {}): UseResizeReturn {
  const [width, setWidthState] = useState<number>(initialWidth);

  // Refs for drag state
  const dragging = useRef<boolean>(false);
  const startX = useRef<number>(0);
  const startW = useRef<number>(0);

  // Load width from localStorage on mount
  useEffect(() => {
    if (!storageKey) return;

    try {
      const savedWidth = localStorage.getItem(storageKey);
      if (savedWidth) {
        const parsed = Number.parseInt(savedWidth, 10);
        if (Number.isFinite(parsed) && parsed >= minWidth && parsed <= maxWidth) {
          setWidthState(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [storageKey, minWidth, maxWidth]);

  // Save width to localStorage when it changes
  useEffect(() => {
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      // Ignore localStorage errors
    }
  }, [width, storageKey]);

  // Attach pointer event listeners to the element if ref provided
  useEffect(() => {
    if (!elementRef?.current || disabled) return;

    const element = elementRef.current;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;

      try {
        element.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture may throw in some environments; continue and fall back to window listeners
      }

      // Attach global listeners so dragging continues even if the pointer leaves the small handle
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragging.current) return;

      // Calculate drag delta (dragging left increases width for right-side sidebar)
      const dx = startX.current - e.clientX;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, startW.current + dx));

      if (nextWidth !== width) {
        setWidthState(nextWidth);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!dragging.current) return;

      dragging.current = false;

      try {
        element.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      // Cleanup global listeners
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    element.addEventListener('pointerdown', handlePointerDown);

    // Keep a cleanup that removes both the element listener and any global listeners
    return () => {
      element.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [elementRef, disabled, width, minWidth, maxWidth]);

  // Wrapper for setWidth to ensure bounds
  const setWidth = useCallback((newWidth: number) => {
    const constrainedWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
    setWidthState(constrainedWidth);
  }, [minWidth, maxWidth]);

  // Pointer event handlers
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;

      dragging.current = true;
      startX.current = e.clientX;
      startW.current = width;

      const target = e.currentTarget as HTMLDivElement;
      const pointerId = e.pointerId;

      try {
        target.setPointerCapture(pointerId);
      } catch {
        // ignore
      }

      // Move handler for window events
      const handleMove = (ev: PointerEvent) => {
        if (!dragging.current) return;
        const dx = startX.current - ev.clientX;
        const nextWidth = Math.min(maxWidth, Math.max(minWidth, startW.current + dx));
        if (nextWidth !== width) setWidthState(nextWidth);
      };

      // Up handler for window events
      const handleUp = (ev: PointerEvent) => {
        if (!dragging.current) return;
        dragging.current = false;
        try {
          target.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
        window.removeEventListener('pointermove', handleMove);
        window.removeEventListener('pointerup', handleUp);
      };

      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
    },
    [disabled, width, minWidth, maxWidth]
  );

  return {
    width,
    onPointerDown,
    setWidth,
  };
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handleOnClickOutside: (event: MouseEvent | TouchEvent) => void
) {
  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }
      handleOnClickOutside(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handleOnClickOutside]);
}

export function usePreventScroll(
  ref: React.RefObject<HTMLElement>,
  shouldPrevent: boolean
) {
  useEffect(() => {
    if (!shouldPrevent || !ref.current) return;

    const element = ref.current;
    const preventScroll = (e: TouchEvent) => {
      e.preventDefault();
      console.log("Preventing scroll");
    };

    element.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      element.removeEventListener('touchmove', preventScroll);
    };
  }, [ref, shouldPrevent]);
}

export function useMobileToggle(isMobile: boolean) {
  const [showToggleButton, setShowToggleButton] = useState(!isMobile);

  useEffect(() => {
    if (!isMobile) {
      setShowToggleButton(true);
      return;
    }

    let hideTimeout: NodeJS.Timeout;
    let startX = 0;
    let startY = 0;
    let hasMoved = false;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      hasMoved = false;
      if (hideTimeout) clearTimeout(hideTimeout);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 5 || dy > 5) {
        hasMoved = true;
        setShowToggleButton(false);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if ((e.target as Element).matches?.('span.highlighted-text[data-highlight-id]')) {
        return;
      }
      if (!hasMoved) {
        setShowToggleButton(prev => !prev);
        hideTimeout = setTimeout(() => setShowToggleButton(false), 4000);
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [isMobile]);

  return showToggleButton;
}


