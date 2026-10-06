import type { Metadata } from 'next';

import { AgendaBoard } from '@/features/secretariat/AgendaBoard';
import { t } from '@/i18n';
import { StaffGate } from '@/lib/session';

export const metadata: Metadata = { title: t('secretariat.agenda.title') };

export default function SecretariatAgendaPage() {
  // Real builds: a session with one of these roles (the API checks again on every call).
  return (
    <StaffGate roles={['SECRETARIAT_HEAD', 'SECRETARIAT_OFFICER']}>
      <AgendaBoard />
    </StaffGate>
  );
}
