import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { SecretariatDashboard } from '@/features/secretariat/SecretariatDashboard';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

export const metadata: Metadata = { title: t('secretariat.title') };

export default function SecretariatPage() {
  // Demo store only in demo builds; real builds require a session (wired in B4).
  if (!DEMO_MODE) redirect('/login');
  return <SecretariatDashboard />;
}
