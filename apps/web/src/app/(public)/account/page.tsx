import type { Metadata } from 'next';

import { AccountPanel } from '@/features/auth/AccountPanel';
import { t } from '@/i18n';
import { RequireSession } from '@/lib/session';

export const metadata: Metadata = { title: t('account.title') };

export default function AccountPage() {
  return (
    <main id="main" className="mx-auto grid max-w-3xl gap-4 p-4 sm:p-6">
      <RequireSession>
        <AccountPanel />
      </RequireSession>
    </main>
  );
}
