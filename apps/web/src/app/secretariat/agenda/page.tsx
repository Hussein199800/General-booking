import type { Metadata } from 'next';

import { AgendaBoard } from '@/features/secretariat/AgendaBoard';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t('secretariat.agenda.title') };

export default function SecretariatAgendaPage() {
  return <AgendaBoard />;
}
