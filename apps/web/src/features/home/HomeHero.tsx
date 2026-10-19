import { GOVERNORATES, PRIORITY_TIERS } from '@sba/shared';
import { ArrowLeft, LogIn, ScrollText, UserRound } from 'lucide-react';
import Link from 'next/link';

import { Seal } from '@/components/Seal';
import { formatNumber, t } from '@/i18n';

/** Facts read from the system's own constants — never invented figures. */
const FACTS = [
  { value: GOVERNORATES.length, label: t('home.hero.facts.branches') },
  { value: PRIORITY_TIERS.length, label: t('home.hero.facts.tiers') },
  { value: 2, label: t('home.hero.facts.doors') },
];

export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="section-dark">
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="grid-veil" aria-hidden="true" />

      <div className="shell grid justify-items-center gap-8 pt-32 pb-16 text-center sm:pt-40 sm:pb-20">
        <Seal id="hero" className="rise size-20 text-gold-300 sm:size-24" />
        <p className="rise rise-1 eyebrow eyebrow-dark">{t('home.hero.eyebrow')}</p>
        <h1 id="hero-title" className="display-1 max-w-5xl text-balance">
          <span className="rise rise-2 block">{t('home.hero.titleLead')}</span>
          <span className="rise rise-3 text-gradient-gold block pb-2">
            {t('home.hero.titleAccent')}
          </span>
        </h1>
        <p className="rise rise-4 lead max-w-2xl text-pretty text-white/75">
          {t('home.hero.lead')}
        </p>
        <div className="rise rise-5 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Link href="/request" className="btn btn-gold btn-lg">
            <ScrollText className="size-5" aria-hidden="true" />
            {t('home.hero.primary')}
          </Link>
          <Link href="/login?door=lawyer" className="btn btn-glass btn-lg">
            <UserRound className="size-5" aria-hidden="true" />
            {t('home.hero.secondary')}
          </Link>
        </div>
        <Link
          href="/login"
          className="rise rise-5 inline-flex items-center gap-2 text-sm text-white/65 underline-offset-4 hover:text-white hover:underline"
        >
          <LogIn className="size-4" aria-hidden="true" />
          {t('home.hero.staff')}
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>

        <ul
          aria-label={t('home.hero.factsLabel')}
          className="fact-frame rise rise-5 mt-6 w-full max-w-4xl sm:grid-cols-3"
        >
          {FACTS.map((fact) => (
            <li key={fact.label} className="fact-tile text-start">
              <p className="text-gradient-gold text-4xl font-extrabold">
                {formatNumber(fact.value)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-white/70">{fact.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
