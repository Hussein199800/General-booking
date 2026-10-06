import type { Metadata } from 'next';

import { SecretariatDashboard } from '@/features/secretariat/SecretariatDashboard';
import { t } from '@/i18n';
import { StaffGate } from '@/lib/session';

export const metadata: Metadata = { title: t('secretariat.title') };

export default function SecretariatPage() {
  // Real builds: a session with one of these roles (the API checks again on every call).
  return (
    <StaffGate roles={['SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER']}>
      <SecretariatDashboard />
    </StaffGate>
  );
}
