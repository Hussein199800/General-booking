import type { Metadata } from 'next';

import { MfaEnrollment } from '@/features/auth/MfaEnrollment';
import { t } from '@/i18n';
import { RequireSession } from '@/lib/session';

export const metadata: Metadata = { title: t('mfa.title') };

export default function MfaPage() {
  return (
    <main id="main" className="mx-auto grid max-w-xl gap-4 p-4 sm:p-6">
      <RequireSession allowWithoutMfa>
        <MfaEnrollment />
      </RequireSession>
    </main>
  );
}
