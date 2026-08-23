'use client';

import { useEffect, useState } from 'react';

const BANNER_STYLES = `
  .pwa-offline-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: #fff;
    background: linear-gradient(90deg, #1a1a2e 0%, #16213e 100%);
    border-top: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 -2px 16px rgba(0,0,0,0.4);
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }
  .pwa-offline-banner.is-visible {
    transform: translateY(0);
    pointer-events: auto;
  }
  .pwa-offline-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 6px #ef4444;
    flex-shrink: 0;
  }
  .pwa-offline-banner.is-online .pwa-offline-dot {
    background: #22c55e;
    box-shadow: 0 0 6px #22c55e;
  }
`;

/**
 * Shows a slim banner at the bottom of the screen when the browser goes
 * offline, and briefly shows "Back online" when connectivity is restored.
 */
export default function OfflineBanner() {
  // Lazy initializer: read navigator.onLine once before the first render.
  // This avoids a synchronous setState call inside the effect (which would
  // trigger a second render cycle and violate the lint rule).
  const [state, setState] = useState<'offline' | 'online' | null>(
    null
  );



  useEffect(() => {

    const handleOffline = () => setState('offline');
    const handleOnline = () => {
      setState('online');
      // Auto-dismiss the "Back online" message after 3 seconds
      setTimeout(() => setState(null), 3000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  });

  if (state === null) return null;

  return (
    <>
      <style>{BANNER_STYLES}</style>
      <div
        role="status"
        aria-live="polite"
        className={`pwa-offline-banner${state !== null ? ' is-visible' : ''}${state === 'online' ? ' is-online' : ''}`}
      >
        <span className="pwa-offline-dot" aria-hidden="true" />
        {state === 'offline'
          ? 'You are offline — your annotations are still available'
          : 'Back online — syncing your changes'}
      </div>
    </>
  );
}
