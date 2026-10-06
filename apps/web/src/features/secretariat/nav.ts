import { CalendarClock, History, LayoutDashboard, Shuffle } from 'lucide-react';

import type { NavEntry } from '@/components/AppShell';
import { t } from '@/i18n';

export function secretariatNav(current: 'dashboard' | 'agenda'): NavEntry[] {
  return [
    {
      href: '/secretariat',
      title: t('secretariat.nav.dashboard'),
      description: t('secretariat.nav.dashboardDesc'),
      icon: LayoutDashboard,
      current: current === 'dashboard',
    },
    {
      href: '/secretariat/agenda',
      title: t('secretariat.nav.agenda'),
      description: t('secretariat.nav.agendaDesc'),
      icon: CalendarClock,
      current: current === 'agenda',
    },
    {
      href: '/secretariat',
      title: t('secretariat.nav.routing'),
      description: t('secretariat.nav.routingDesc'),
      icon: Shuffle,
      disabled: true,
    },
    {
      href: '/secretariat',
      title: t('secretariat.nav.audit'),
      description: t('secretariat.nav.auditDesc'),
      icon: History,
      disabled: true,
    },
  ];
}
