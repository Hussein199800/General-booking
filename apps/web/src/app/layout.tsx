import './globals.css';

import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import type { ReactNode } from 'react';

import { t } from '@/i18n';

export const metadata: Metadata = {
  title: {
    default: `${t('app.systemName')} — ${t('app.institutionName')}`,
    template: `%s — ${t('app.systemName')}`,
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0b1b3a',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The CSP nonce is generated per request (src/proxy.ts), so every page must be
  // rendered per request; a prerendered page would carry no nonce and its
  // bootstrap scripts would be blocked. The static GitHub Pages preview has no
  // server (and no proxy), so it is the one build that skips this.
  if (process.env.NEXT_PUBLIC_SBA_PREVIEW !== '1') await connection();

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:rounded focus:bg-navy-900 focus:px-4 focus:py-2 focus:text-gold-50"
        >
          {t('app.skipToContent')}
        </a>
        {children}
      </body>
    </html>
  );
}
