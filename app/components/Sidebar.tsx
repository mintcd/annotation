"use client";

import React, { useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAnnotationContext } from "../context/Annotation.context";
import { useMobile, useHotkey } from "../hooks";
import { useResize, useClickOutside, useMobileToggle, usePreventScroll } from "../hooks/Sidebar.hooks";
import AnnotationList from "./AnnotationList";
import { sortAnnotations, sortOptions } from "../utils/annotations";
import type { SortOption } from "../utils/annotations";
import { BoxList, Sort } from "../../public/icons";
import Dropdown from "./Dropdown";
import { escapeAttrValue } from "../utils/string";
import styles from "../styles/Sidebar.styles";

export default function Sidebar() {
  const { annotations, syncStatus } = useAnnotationContext()
  const [sortOption, setSortOption] = useState<SortOption>('dom-order');
  const items = useMemo(() => sortAnnotations(annotations, sortOption), [annotations, sortOption]);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Mobile detection and viewport tracking
  const { isMobile, isIOS, viewportInfo } = useMobile();
  const [open, setOpen] = useState(false);
  const showToggleButton = useMobileToggle(isMobile);

  const scrollToAnnotation = useCallback((id: string) => {
    const spans = document.querySelectorAll<HTMLSpanElement>(`[data-highlight-id="${escapeAttrValue(id)}"]`);
    const span = spans[0];
    if (isMobile) setOpen(false);

    if (span) {
      span.scrollIntoView({ behavior: "instant", block: "center" });
    }
  }, [isMobile]);

  // Resizing functionality
  const handleRef = useRef<HTMLDivElement>(null);
  const { width, onPointerDown } = useResize({
    initialWidth: 320,
    minWidth: 240,
    maxWidth: 560,
    storageKey: "anno.sidebar.width",
    disabled: isMobile,
    elementRef: handleRef as React.RefObject<HTMLElement>,
  });

  useHotkey((e) => (e.altKey || e.metaKey) && e.key.toLowerCase() === "s",
    () => setOpen((o: boolean) => !o));

  useClickOutside(sidebarRef as React.RefObject<HTMLElement>, () => setOpen(false));
  // Memoize panel width calculation
  const panelWidthStyle: React.CSSProperties = useMemo(() =>
    isMobile ? { width: viewportInfo.visualWidth } : { width }, [isMobile, viewportInfo.visualWidth, width]);

  // Memoize sidebar positioning for mobile
  const sidebarMobileStyle = {
    height: viewportInfo.visualHeight * 0.6,
    width: viewportInfo.visualWidth,
    bottom: viewportInfo.layoutHeight - viewportInfo.offsetTop - viewportInfo.visualHeight,
    left: 0,
  }
  usePreventScroll(sidebarRef as React.RefObject<HTMLElement>, isMobile);
  // Animation variants for better performance
  const sidebarVariants = useMemo(() => ({
    hidden: isMobile
      ? { y: "100%" }
      : { x: "100%" },
    visible: isMobile
      ? { y: 0 }
      : { x: 0 },
    exit: isMobile
      ? { y: "100%" }
      : { x: "100%" }
  }), [isMobile]);

  return (
    <>
      <AnimatePresence>
        {showToggleButton && (
          <motion.div
            onClick={() => setOpen(true)}
            style={styles.toggleButton(isMobile, isIOS, viewportInfo)}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
          >
            <BoxList size={50} />
          </motion.div>
        )}
      </AnimatePresence>

      {open && (
        <div
          ref={sidebarRef}
          style={{ ...styles.sidebarContainer(isMobile, viewportInfo, width), ...(isMobile ? sidebarMobileStyle : {}) }}
        >
          <div style={styles.headerSection}>
            <span style={styles.statsContainer}>
              <span style={styles.statsText}>
                {annotations.length} total
                {items.length !== annotations.length ? <span> • {items.length} shown</span> : null}
              </span>
              <Dropdown
                options={sortOptions}
                value={sortOption}
                onChange={setSortOption}
                buttonContent={<Sort />}
                ariaLabel="Sort annotations"
              />
            </span>
            <span style={styles.syncContainer}>
              {syncStatus === 'syncing' ? (
                <span style={styles.syncingText}>Syncing...</span>
              ) : syncStatus === 'synced' ? (
                <span style={styles.syncedText}>Synced</span>
              ) : (
                <span style={styles.syncingText}>Unsaved changes</span>
              )}
            </span>
          </div>
          {isMobile || !onPointerDown ? null : (
            <div
              ref={handleRef}
              role="separator"
              aria-orientation="vertical"
              onPointerDown={onPointerDown}
              style={styles.resizeHandle}
              title="Drag to resize"
            />
          )}
          <AnnotationList scrollToAnnotation={scrollToAnnotation} mode="compact" />
        </div>
      )}
    </>
  );
};

