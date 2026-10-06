import {
  ArrowLeft,
  CalendarClock,
  FileLock2,
  Gavel,
  LayoutDashboard,
  LogIn,
  ScrollText,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

import { Seal } from '@/components/Seal';
import { t } from '@/i18n';

const previews = [
  {
    href: '/secretariat',
    icon: LayoutDashboard,
    title: t('home.previewLinks.secretariat'),
    description: t('home.previewLinks.secretariatDesc'),
  },
  {
    href: '/syndic',
    icon: CalendarClock,
    title: t('home.previewLinks.syndic'),
    description: t('home.previewLinks.syndicDesc'),
  },
  {
    href: '/login',
    icon: LogIn,
    title: t('home.previewLinks.login'),
    description: t('home.previewLinks.loginDesc'),
  },
];

export default function HomePage() {
  return (
    <main id="main" className="mx-auto grid max-w-6xl gap-6 p-4 sm:p-6 lg:p-8">
      <section className="hero grid gap-6 p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
        <div className="relative">
          <p className="text-sm text-gold-300">{t('app.institutionName')}</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight sm:text-4xl">
            {t('app.systemName')}
          </h1>
          <p className="mt-4 max-w-prose text-base leading-relaxed text-navy-100 sm:text-lg">
            {t('home.intro')}
          </p>
          <Link href="/login" className="btn mt-6 bg-gold-500 text-navy-950 hover:bg-gold-300">
            <LogIn className="size-5" aria-hidden="true" />
            {t('home.staffEntry')}
          </Link>
        </div>
        <Seal id="home" className="relative mx-auto size-32 text-gold-300 sm:size-40" />
      </section>

      <section aria-labelledby="services-heading" className="grid gap-4">
        <h2 id="services-heading" className="text-xl font-bold">
          {t('home.servicesHeading')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            {
              icon: ScrollText,
              title: t('home.services.audienceRequest'),
              body: t('home.servicesDesc.audienceRequest'),
            },
            {
              icon: UserRound,
              title: t('home.services.lawyerPortal'),
              body: t('home.servicesDesc.lawyerPortal'),
            },
          ].map((service) => (
            <article key={service.title} className="card flex gap-4 p-5">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-navy-50 text-navy-700">
                <service.icon className="size-6" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold">{service.title}</h3>
                  <span className="badge bg-gold-50 text-gold-700">{t('nav.comingSoon')}</span>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{service.body}</p>
              </div>
            </article>
          ))}
        </div>
        <p role="status" className="text-sm text-ink-muted">
          {t('home.servicesPending')}
        </p>
      </section>

      <section aria-labelledby="preview-heading" className="card grid gap-4 p-5 sm:p-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="preview-heading" className="text-xl font-bold">
              {t('home.previewHeading')}
            </h2>
            <span className="badge bg-gold-50 text-gold-700">{t('preview.badge')}</span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{t('home.previewIntro')}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {previews.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-start gap-3 rounded-2xl border border-line p-4 transition hover:border-navy-600 hover:bg-navy-50"
            >
              <item.icon className="mt-0.5 size-6 shrink-0 text-navy-700" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{item.title}</span>
                <span className="block text-sm text-ink-muted">{item.description}</span>
              </span>
              <ArrowLeft
                className="mt-1 size-5 shrink-0 text-ink-subtle transition group-hover:-translate-x-1"
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="trust-heading" className="grid gap-3">
        <h2 id="trust-heading" className="text-xl font-bold">
          {t('home.trust.heading')}
        </h2>
        <ul className="grid gap-3 md:grid-cols-3">
          {[
            { icon: Gavel, text: t('home.trust.human') },
            { icon: FileLock2, text: t('home.trust.encrypted') },
            { icon: ShieldCheck, text: t('home.trust.audit') },
          ].map((point) => (
            <li
              key={point.text}
              className="stat-card flex items-center gap-3 [--stat-accent:var(--color-gold-500)]"
            >
              <point.icon className="size-6 shrink-0 text-navy-700" aria-hidden="true" />
              <span className="font-bold">{point.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
