import type { Metadata } from 'next';

import { SyndicAgenda } from '@/features/syndic/SyndicAgenda';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t('syndic.title') };

export default function SyndicPage() {
  return <SyndicAgenda />;
}
