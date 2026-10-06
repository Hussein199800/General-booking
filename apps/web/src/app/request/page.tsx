import type { Metadata } from 'next';
import Link from 'next/link';

import { PreviewBanner } from '@/components/PreviewBanner';
import { PublicRequestForm } from '@/features/public/PublicRequestForm';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

export const metadata: Metadata = { title: t('request.title') };

export default function RequestPage() {
  return (
    <main id="main" className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <Link href="/" className="text-sm text-navy-700 underline">
        {t('nav.backHome')}
      </Link>
      <section className="hero p-6 sm:p-8">
        <h1 className="relative text-2xl font-bold">{t('request.title')}</h1>
        <p className="relative mt-2 text-navy-100">{t('request.subtitle')}</p>
      </section>
      {DEMO_MODE && (
        <>
          <PreviewBanner />
          <p className="rounded-xl bg-gold-50 p-3 text-sm text-gold-700">
            {t('request.previewDisabled')}
          </p>
        </>
      )}
      <PublicRequestForm disabled={DEMO_MODE} />
    </main>
  );
}
