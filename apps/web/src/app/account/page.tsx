import type { Metadata } from 'next';

import { AccountPanel } from '@/features/auth/AccountPanel';
import { PublicShell } from '@/components/site/PublicShell';
import { t } from '@/i18n';
import { RequireSession } from '@/lib/session';

export const metadata: Metadata = { title: t('account.title') };

export default function AccountPage() {
  return (
    <PublicShell width="max-w-3xl">
      <RequireSession>
        <AccountPanel />
      </RequireSession>
    </PublicShell>
  );
}
