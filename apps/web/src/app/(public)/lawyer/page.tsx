import type { Metadata } from 'next';
import Link from 'next/link';

import { PreviewBanner } from '@/components/PreviewBanner';
import { LawyerPortal } from '@/features/lawyer/LawyerPortal';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';
import { RequireSession } from '@/lib/session';

export const metadata: Metadata = { title: t('lawyer.portal') };

export default function LawyerPage() {
  return (
    <main id="main" className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      {DEMO_MODE ? (
        <>
          <PreviewBanner />
          <p className="card p-6 leading-relaxed">{t('lawyer.previewUnavailable')}</p>
          <Link href="/" className="btn btn-secondary justify-self-start">
            {t('nav.backHome')}
          </Link>
        </>
      ) : (
        <RequireSession roles={['LAWYER']}>
          <LawyerPortal />
        </RequireSession>
      )}
    </main>
  );
}
