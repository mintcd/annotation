"use client";

import { useCallback, useEffect, useState } from "react";

type UseMobileReturn = {
  isMobile: boolean;
  isIOS: boolean;
  viewportInfo: {
    layoutWidth: number;
    layoutHeight: number;
    visualWidth: number;
    visualHeight: number;
    offsetTop: number;
    offsetLeft: number
  };
  updateViewportInfo: () => void;
};

export function useMobile(): UseMobileReturn {
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [viewportInfo, setViewportInfo] = useState<{ layoutWidth: number; layoutHeight: number; visualWidth: number; visualHeight: number; offsetTop: number; offsetLeft: number }>({ layoutWidth: 0, layoutHeight: 0, visualWidth: 0, visualHeight: 0, offsetTop: 0, offsetLeft: 0 });

  useEffect(() => {
    const checkTouch = () => {
      setIsMobile('ontouchstart' in window || navigator.maxTouchPoints > 0);
      setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    };
    checkTouch();
  }, []);

  const updateViewportInfo = useCallback(() => {
    if (window.visualViewport) {
      setViewportInfo({
        layoutWidth: window.innerWidth,
        layoutHeight: window.innerHeight,
        visualWidth: window.visualViewport.width,
        visualHeight: window.visualViewport.height,
        offsetTop: window.visualViewport.offsetTop,
        offsetLeft: window.visualViewport.offsetLeft
      });
    }
  }, []);

  useEffect(() => {
    if (!isMobile) return;

    updateViewportInfo();

    // Listen to visualViewport events for mobile-specific changes
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportInfo);
      window.visualViewport.addEventListener('scroll', updateViewportInfo);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportInfo);
        window.visualViewport.removeEventListener('scroll', updateViewportInfo);
      }
    }
  }, [isMobile, updateViewportInfo])


  return { isMobile, isIOS, viewportInfo, updateViewportInfo };
}