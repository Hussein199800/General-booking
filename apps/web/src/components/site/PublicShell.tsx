import type { ReactNode } from 'react';

import { SiteFooter } from './SiteFooter';
import { SiteHeader } from './SiteHeader';

/** Header + content + footer for public and lawyer-facing pages. */
export function PublicShell({
  children,
  width = 'max-w-3xl',
}: {
  readonly children: ReactNode;
  readonly width?: 'max-w-xl' | 'max-w-3xl' | 'max-w-4xl' | 'max-w-6xl';
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main
        id="main"
        className={`mx-auto grid w-full ${width} flex-1 content-start gap-4 p-4 sm:p-6`}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
