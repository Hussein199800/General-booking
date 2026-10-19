import type { Metadata } from 'next';

import { RescheduleResponse } from '@/features/public/RescheduleResponse';
import { PublicShell } from '@/components/site/PublicShell';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

export const metadata: Metadata = {
  title: t('reschedule.title'),
  // The fragment never leaves the browser, but keep the page out of referrers anyway.
  referrer: 'no-referrer',
};

export default function ReschedulePage() {
  return (
    <PublicShell width="max-w-xl">
      <section className="hero p-6">
        <h1 className="relative text-2xl font-bold">{t('reschedule.title')}</h1>
      </section>
      <RescheduleResponse disabled={DEMO_MODE} />
    </PublicShell>
  );
}
