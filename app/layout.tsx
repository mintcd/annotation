import { ReactNode } from 'react';
import '../components/design-system/styles/tokens.css';
import '../components/styles/global.css';

import { SyncEngineProvider } from '../core/persistence';
import { Metadata } from 'next';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';
import OfflineBanner from '../components/OfflineBanner';

export const metadata: Metadata = {
  title: 'HTML Annotation App',
  description: 'Offline-capable HTML annotation tool',
  manifest: '/manifest.json',
  themeColor: '#000000',
};

export const runtime = 'edge';

export default function RootLayout({ children }: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SyncEngineProvider>
          {children}
        </SyncEngineProvider>
        {/* PWA: register SW and show offline/online status */}
        <ServiceWorkerRegister />
        {/* <OfflineBanner /> */}
      </body>
    </html>
  );
}
