import type { Metadata } from 'next';

import { MemberAgenda } from '@/features/member/MemberAgenda';
import { t } from '@/i18n';
import { StaffGate } from '@/lib/session';

export const metadata: Metadata = { title: t('member.title') };

export default function MemberPage() {
  // Real builds: a session with one of these roles (the API checks again on every call).
  return (
    <StaffGate roles={['COUNCIL_MEMBER']}>
      <MemberAgenda />
    </StaffGate>
  );
}
