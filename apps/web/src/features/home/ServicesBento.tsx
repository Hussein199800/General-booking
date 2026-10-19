import { Activity, ArrowLeft, Building2, CalendarDays, ScrollText, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/Reveal';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

import { SectionHeading } from './SectionHeading';

/** Services as a bento grid: the two public services lead, internal tools follow. */
export function ServicesBento() {
  return (
    <section
      id="services"
      className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6"
      aria-labelledby="services-title"
    >
      <SectionHeading
        id="services-title"
        eyebrow={t('home.bento.eyebrow')}
        title={t('home.bento.title')}
        lede={t('home.bento.lede')}
      />
      <div className="grid gap-4 md:grid-cols-6">
        <Reveal className="md:col-span-4">
          <Link
            href="/request"
            className="hero card-link group grid h-full min-h-72 content-between gap-8 p-7 sm:p-9"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-gold-500/15 text-gold-300 ring-1 ring-gold-300/30">
              <ScrollText className="size-7" aria-hidden="true" />
            </span>
            <span className="grid gap-3">
              <span className="flex flex-wrap items-center gap-2">
                <span className="headline text-white">{t('home.services.audienceRequest')}</span>
                {DEMO_MODE && (
                  <span className="badge bg-gold-500/20 text-gold-100">{t('preview.badge')}</span>
                )}
              </span>
              <span className="lede max-w-xl text-navy-100">
                {t('home.servicesDesc.audienceRequest')}
              </span>
              <span className="mt-2 inline-flex items-center gap-2 font-bold text-gold-300">
                {t('home.bento.requestCta')}
                <ArrowLeft
                  className="size-4 transition-transform duration-300 group-hover:-translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </span>
          </Link>
        </Reveal>

        <Reveal delay={1} className="md:col-span-2">
          <Link
            href="/login"
            className="card card-link group grid h-full min-h-72 content-between gap-6 bg-gradient-to-br from-surface via-surface to-cedar-50 p-7"
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-cedar-100 text-cedar-700">
              <UserRound className="size-7" aria-hidden="true" />
            </span>
            <span className="grid gap-2">
              <span className="text-2xl font-bold">{t('home.services.lawyerPortal')}</span>
              <span className="text-ink-muted">{t('home.servicesDesc.lawyerPortal')}</span>
              <span className="mt-2 inline-flex items-center gap-2 font-bold text-cedar-700">
                {t('home.bento.lawyerCta')}
                <ArrowLeft
                  className="size-4 transition-transform duration-300 group-hover:-translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </span>
          </Link>
        </Reveal>

        <Reveal delay={1} className="md:col-span-2">
          <Link
            href="/login"
            className="card card-link group grid h-full content-between gap-6 bg-gradient-to-br from-surface to-gold-50 p-7"
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-gold-100 text-gold-700">
              <Building2 className="size-6" aria-hidden="true" />
            </span>
            <span className="grid gap-2">
              <span className="text-xl font-bold">{t('home.bento.staffTitle')}</span>
              <span className="text-sm text-ink-muted">{t('home.bento.staffBody')}</span>
              <span className="mt-1 inline-flex items-center gap-2 text-sm font-bold text-gold-700">
                {t('home.bento.staffCta')}
                <ArrowLeft
                  className="size-4 transition-transform duration-300 group-hover:-translate-x-1"
                  aria-hidden="true"
                />
              </span>
            </span>
          </Link>
        </Reveal>

        <Reveal delay={2} className="md:col-span-2">
          <div className="card grid h-full content-between gap-6 bg-gradient-to-br from-surface to-sky-100 p-7">
            <span className="relative grid size-12 place-items-center rounded-2xl bg-sky-100 text-sky-500">
              <Activity className="size-6" aria-hidden="true" />
              <span className="absolute -top-1 -end-1 flex size-3">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-tier-standard opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-tier-standard" />
              </span>
            </span>
            <span className="grid gap-2">
              <span className="text-xl font-bold">{t('home.bento.liveTitle')}</span>
              <span className="text-sm text-ink-muted">{t('home.bento.liveBody')}</span>
            </span>
          </div>
        </Reveal>

        <Reveal delay={3} className="md:col-span-2">
          <div className="card grid h-full content-between gap-6 bg-gradient-to-br from-surface to-plum-100 p-7">
            <span className="grid size-12 place-items-center rounded-2xl bg-plum-100 text-plum-700">
              <CalendarDays className="size-6" aria-hidden="true" />
            </span>
            <span className="grid gap-2">
              <span className="text-xl font-bold">{t('home.bento.calendarTitle')}</span>
              <span className="text-sm text-ink-muted">{t('home.bento.calendarBody')}</span>
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
