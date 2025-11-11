'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then(() => {
            console.log('Cached');
          })
          .catch((registrationError) => {
            console.log('Cached failed.', registrationError);
          });
      });
    }
  }, []);

  return null;
}