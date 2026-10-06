import type { Metadata } from 'next';

import { MemberAgenda } from '@/features/member/MemberAgenda';
import { t } from '@/i18n';

export const metadata: Metadata = { title: t('member.title') };

export default function MemberPage() {
  return <MemberAgenda />;
}
