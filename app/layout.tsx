import { ReactNode } from 'react';
import '../styles/global.css';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';

export const metadata = {
  title: 'Annotation',
  description: 'Annotation for HTML and PDF documents',
};

export const runtime = 'edge';

export default function RootLayout({ children }: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>
        {/* <ServiceWorkerRegister /> */}
        {children}
      </body>
    </html>
  );
}