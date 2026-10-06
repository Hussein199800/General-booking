import type { Metadata } from 'next';

import { SecretariatDashboard } from '@/features/secretariat/SecretariatDashboard';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t('secretariat.title') };

export default function SecretariatPage() {
  return <SecretariatDashboard />;
}
