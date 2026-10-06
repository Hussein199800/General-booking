import type { Metadata } from 'next';

import { RescheduleResponse } from '@/features/public/RescheduleResponse';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

export const metadata: Metadata = {
  title: t('reschedule.title'),
  // The fragment never leaves the browser, but keep the page out of referrers anyway.
  referrer: 'no-referrer',
};

export default function ReschedulePage() {
  return (
    <main id="main" className="mx-auto grid max-w-xl gap-4 p-4 sm:p-6">
      <section className="hero p-6">
        <h1 className="relative text-2xl font-bold">{t('reschedule.title')}</h1>
      </section>
      <RescheduleResponse disabled={DEMO_MODE} />
    </main>
  );
}
