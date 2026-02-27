"use client";

import { useEffect } from 'react';
import { useLoggerSignals } from '../hooks/Logger.hooks';
import Loader from './Loader';
import sidebarStyles from '../styles/Sidebar.styles';
import { useMobile } from '../hooks/useMobile';

export default function Logger({ info }: { info: { title?: string; totalTime?: number; error?: string | null; rangeResults?: Array<{ id: string; snippet: string; success: boolean; message?: string, }>, success: boolean; numberOfScripts?: number; executedScripts?: number } }) {
  const signals = useLoggerSignals();
  const { isMobile, isIOS, viewportInfo } = useMobile();
  const vi = viewportInfo as unknown as { layoutWidth: number; layoutHeight: number; visualWidth: number; visualHeight: number; offsetTop: number; offsetLeft: number };
  const toggleStyle = sidebarStyles.toggleButton(isMobile, isIOS, vi);

  useEffect(() => {
    console.log('[Logger] info:', info);
  }, [info]);

  useEffect(() => {
    if (signals.length > 0) {
      console.log('[Logger] signals:', signals);
    }
  }, [signals]);

  return (
    <div
      role="button"
      aria-label="Show logs"
      style={{ ...toggleStyle, cursor: 'pointer' }}
    >
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 20, height: 20 }}>
          <Loader />
        </div>
      </div>
    </div>
  );
}