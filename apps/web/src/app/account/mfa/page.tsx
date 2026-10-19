import type { Metadata } from 'next';

import { MfaEnrollment } from '@/features/auth/MfaEnrollment';
import { PublicShell } from '@/components/site/PublicShell';
import { t } from '@/i18n';
import { RequireSession } from '@/lib/session';

export const metadata: Metadata = { title: t('mfa.title') };

export default function MfaPage() {
  return (
    <PublicShell width="max-w-xl">
      <RequireSession allowWithoutMfa>
        <MfaEnrollment />
      </RequireSession>
    </PublicShell>
  );
}
