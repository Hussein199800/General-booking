import type { Metadata } from 'next';

import { PreviewBanner } from '@/components/PreviewBanner';
import { UnitInbox } from '@/features/units/UnitInbox';
import { PublicShell } from '@/components/site/PublicShell';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';
import { RequireSession } from '@/lib/session';

export const metadata: Metadata = { title: t('units.title') };

export default function UnitsPage() {
  return (
    <PublicShell width="max-w-4xl">
      {DEMO_MODE ? (
        <>
          <PreviewBanner />
          <p className="card p-6 leading-relaxed">{t('units.previewUnavailable')}</p>
        </>
      ) : (
        <RequireSession roles={['BRANCH_OFFICER', 'COMMITTEE_MEMBER']}>
          <UnitInbox />
        </RequireSession>
      )}
    </PublicShell>
  );
}
