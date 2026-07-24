'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js as the PWA service worker.
 * Must be rendered in a Client Component so that the registration
 * runs in the browser, not on the server/edge.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          // The SW itself sets Cache-Control: no-cache via headers, so the
          // browser will always re-fetch it to check for updates.
          updateViaCache: 'none',
        });

        // Prompt the waiting SW to activate immediately so users get the
        // latest version without needing to close all tabs.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // A new SW is waiting. Tell it to skip waiting so it activates
              // right away. The page will reload once it controls the client.
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // Reload once the new SW takes control so fresh assets are served.
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch (err) {
        console.warn('[PWA] Service worker registration failed:', err);
      }
    };

    // Defer registration until after the page has loaded so it doesn't
    // compete with critical resources.
    if (document.readyState === 'complete') {
      void register();
    } else {
      window.addEventListener('load', () => void register(), { once: true });
    }
  }, []);

  return null;
}
