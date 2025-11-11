"use client";

import React, { useState, useRef, useLayoutEffect, useEffect } from 'react';
import Logger from './Logger';
import Loader from './Loader';
import sidebarStyles from '../styles/Sidebar.styles';
import { useMobile } from '../hooks/useMobile';
import { AnimatePresence, motion } from 'framer-motion';

export default function LoggerToggle({ info }: { info: { title?: string; totalTime?: number; error?: string | null; rangeResults?: Array<{ id: string; snippet: string; success: boolean; message?: string, }>, success: boolean } }) {
  const [open, setOpen] = useState(false);
  const { isMobile, isIOS, viewportInfo } = useMobile();

  const vi = viewportInfo as unknown as { layoutWidth: number; layoutHeight: number; visualWidth: number; visualHeight: number; offsetTop: number; offsetLeft: number };
  const toggleStyle = sidebarStyles.toggleButton(isMobile, isIOS, vi);

  const buttonRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<{ left: number; top: number } | null>(null);

  // Compute panel position when opened
  useLayoutEffect(() => {
    if (!open) return;
    const btn = buttonRef.current;
    const panel = panelRef.current;
    const panelWidth = 360;
    const gap = 8;
    if (btn) {
      const r = btn.getBoundingClientRect();
      // default left centers the panel above the button
      const left = Math.max(8, r.left + r.width / 2 - panelWidth / 2);
      const top = Math.max(8, r.top - (panel ? (panel.offsetHeight || 240) : 240) - gap);
      setPanelPos({ left, top });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (buttonRef.current && buttonRef.current.contains(target)) return;
      if (panelRef.current && panelRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            style={{
              position: 'fixed',
              zIndex: 10001,
              left: panelPos ? `${panelPos.left}px` : '50%',
              top: panelPos ? `${panelPos.top}px` : 'auto',
              transform: panelPos ? undefined : 'translateX(-50%)',
              maxWidth: 360,
            }}
          >
            <Logger info={info} />
          </motion.div>
        )}
      </AnimatePresence>

      <div
        role="button"
        aria-label="Show logs"
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        style={{ ...toggleStyle, cursor: 'pointer' }}
      >
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 20, height: 20 }}>
            <Loader />
          </div>
        </div>
      </div>
    </>
  );
}
