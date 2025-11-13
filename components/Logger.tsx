"use client";

import { useState, useRef } from 'react';
import loggerStyles from '../styles/Logger.styles';
import { useLoggerSignals } from '../hooks/Logger.hooks';
import Loader from './Loader';
import sidebarStyles from '../styles/Sidebar.styles';
import { useMobile } from '../hooks/useMobile';
import { useClickOutside } from '../hooks/Sidebar.hooks';

export default function Logger({ info }: { info: { title?: string; totalTime?: number; error?: string | null; rangeResults?: Array<{ id: string; snippet: string; success: boolean; message?: string, }>, success: boolean; numberOfScripts?: number; executedScripts?: number } }) {
  // signals hook
  const signals = useLoggerSignals();
  const { totalTime, error, rangeResults, success, numberOfScripts, executedScripts } = info;

  // toggle / panel state
  const [open, setOpen] = useState(true);
  const { isMobile, isIOS, viewportInfo } = useMobile();
  const vi = viewportInfo as unknown as { layoutWidth: number; layoutHeight: number; visualWidth: number; visualHeight: number; offsetTop: number; offsetLeft: number };
  const toggleStyle = sidebarStyles.toggleButton(isMobile, isIOS, vi);



  const buttonRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(panelRef as React.RefObject<HTMLDivElement>, () => setOpen(false));

  const handleReload = () => {
    try { window.location.reload(); } catch { }
  };

  const handleRemove = (id: string) => { };

  return (
    <>
      <div style={{
        ...loggerStyles.container, position: 'fixed',
        zIndex: 10001,
        right: toggleStyle.right as number,
        bottom: `calc(${typeof toggleStyle.bottom === 'number' ? `${toggleStyle.bottom}px` : toggleStyle.bottom} + ${toggleStyle.height} + 40px)`,
      }}>
        {signals.length > 0 && (
          <>
            <div style={{ marginBottom: 8, color: '#374151', fontSize: 13 }}>
              {numberOfScripts !== undefined
                ? `Executed ${executedScripts ?? signals.length}/${numberOfScripts} scripts`
                : `Executed ${signals.length} script${signals.length !== 1 ? 's' : ''}`
              }
              {success && <span> ✅ </span>}
            </div>
            <div style={{ maxHeight: 160, overflowY: 'auto' }}>
              {signals.map((s) => (
                <code key={s} style={loggerStyles.code} title={s}>{s}</code>
              ))}
            </div>
          </>
        )}
        {error && (
          <div style={loggerStyles.errorMessage}>
            <span >❌</span> Error: {error}
          </div>
        )}

        <div style={loggerStyles.rangeResultsContainer}>
          {rangeResults?.map((r, index) => (
            <div key={r.id}>
              <div style={loggerStyles.rangeResultHeader}>
                <span style={loggerStyles.rangeResultStatus}>{r.success ? '✅' : '❌'}</span>
                <strong style={loggerStyles.rangeResultStrong(r.success)}>
                  {r.success ? 'Matched' : 'Failed'}
                </strong>
              </div>
              <div style={loggerStyles.rangeSnippet} title={r.snippet}>{r.snippet}</div>
              {r.message && <div style={loggerStyles.rangeMessage} title={r.message}>{r.message}</div>}
              <div style={loggerStyles.actionButtons}>
                <button
                  onClick={() => handleReload()}
                  style={loggerStyles.reloadButton}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1D4ED8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                >
                  Reload page
                </button>
                <button
                  onClick={() => handleRemove(r.id)}
                  style={loggerStyles.removeButton}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#B91C1C'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC2626'}
                >
                  Remove text
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

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