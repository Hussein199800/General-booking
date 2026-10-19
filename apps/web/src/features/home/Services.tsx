import {
  ArrowLeft,
  CalendarClock,
  Inbox,
  LayoutDashboard,
  ScrollText,
  UserRound,
  UserRoundCheck,
} from 'lucide-react';
import Link from 'next/link';

import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

const STAFF = [
  { href: '/secretariat', icon: LayoutDashboard, key: 'secretariat' },
  { href: '/syndic', icon: CalendarClock, key: 'syndic' },
  { href: '/member', icon: UserRoundCheck, key: 'member' },
  { href: '/units', icon: Inbox, key: 'units' },
] as const;

function PreviewBadge() {
  return DEMO_MODE ? (
    <span className="badge bg-gold-50 text-gold-700">{t('preview.badge')}</span>
  ) : null;
}

export function Services() {
  return (
    <section id="services" aria-labelledby="services-heading" className="py-20 sm:py-28">
      <div className="shell grid gap-12">
        <header className="reveal grid justify-items-center gap-4 text-center">
          <p className="eyebrow">{t('home.services.eyebrow')}</p>
          <h2 id="services-heading" className="display-2 text-gradient-ink max-w-3xl text-balance">
            {t('home.services.heading')}
          </h2>
          <p className="lead max-w-2xl text-ink-muted">{t('home.services.lead')}</p>
        </header>

        <div className="bento">
          <div className="reveal bento-wide">
            <Link href="/request" className="tile tile-ink lift h-full min-h-80 justify-between">
              <div className="grid gap-4">
                <span className="tile-icon">
                  <ScrollText className="size-6" aria-hidden="true" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-extrabold sm:text-4xl">
                    {t('home.services.audience.title')}
                  </h3>
                  <PreviewBadge />
                </div>
                <p className="lead max-w-xl text-white/75">{t('home.services.audience.body')}</p>
              </div>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <ul className="flex flex-wrap gap-2">
                  {(['point1', 'point2', 'point3'] as const).map((point) => (
                    <li key={point} className="point">
                      {t(`home.services.audience.${point}`)}
                    </li>
                  ))}
                </ul>
                <span className="inline-flex items-center gap-2 font-bold text-gold-300">
                  {t('home.services.open')}
                  <ArrowLeft className="lift-arrow size-5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          </div>

          <div className="reveal bento-tall">
            <Link href="/login?door=lawyer" className="tile tile-olive lift h-full justify-between">
              <div className="grid gap-4">
                <span className="tile-icon bg-olive-100 text-olive-700">
                  <UserRound className="size-6" aria-hidden="true" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-2xl font-extrabold">{t('home.services.lawyer.title')}</h3>
                  <PreviewBadge />
                </div>
                <p className="text-ink-muted">{t('home.services.lawyer.body')}</p>
              </div>
              <ul className="grid gap-2">
                {(['point1', 'point2', 'point3'] as const).map((point) => (
                  <li key={point} className="point justify-self-start bg-surface">
                    {t(`home.services.lawyer.${point}`)}
                  </li>
                ))}
              </ul>
              <span className="inline-flex items-center gap-2 font-bold text-olive-700">
                {t('home.services.signInRequired')}
                <ArrowLeft className="lift-arrow size-5" aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="reveal flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold">{t('home.services.staffHeading')}</h3>
            <PreviewBadge />
            {DEMO_MODE && <p className="w-full text-sm text-ink-muted">{t('home.previewIntro')}</p>}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STAFF.map((item) => (
              <li key={item.key} className="reveal">
                <Link href={item.href} className="tile lift h-full gap-3">
                  <span className="tile-icon size-12">
                    <item.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-bold">{t(`home.services.${item.key}.title`)}</span>
                  <span className="text-sm text-ink-muted">
                    {t(`home.services.${item.key}.body`)}
                  </span>
                  <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-navy-700">
                    {t('home.services.signInRequired')}
                    <ArrowLeft className="lift-arrow size-4" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {DEMO_MODE && (
            <p role="status" className="text-sm text-ink-muted">
              {t('home.services.pending')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
