import type { ReactNode } from 'react';

import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';

/** Public and personal pages share the glass header and the footer of the home page. */
export default function PublicLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="min-h-[70dvh] py-6 sm:py-10">{children}</div>
      <SiteFooter />
    </>
  );
}
