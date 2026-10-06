import type { Metadata } from 'next';

import { SyndicAgenda } from '@/features/syndic/SyndicAgenda';
import { t } from '@/i18n';
import { StaffGate } from '@/lib/session';

export const metadata: Metadata = { title: t('syndic.title') };

export default function SyndicPage() {
  // Real builds: a session with one of these roles (the API checks again on every call).
  return (
    <StaffGate roles={['GRAND_SYNDIC']}>
      <SyndicAgenda />
    </StaffGate>
  );
}
