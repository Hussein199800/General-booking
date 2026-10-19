import {
  ArrowLeft,
  ChevronDown,
  FileLock2,
  Gavel,
  ScrollText,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';

import { Seal } from '@/components/Seal';
import { t } from '@/i18n';

/**
 * Landing hero: deep night field with a slow aurora, an engraved grid and the
 * seal at the centre of rotating rings. Text enters with a staggered rise.
 * It sits under the transparent site header (negative top margin).
 */
export function HomeHero() {
  const chips = [
    { icon: Gavel, text: t('home.hero.chip1') },
    { icon: ShieldCheck, text: t('home.hero.chip2') },
    { icon: FileLock2, text: t('home.hero.chip3') },
  ];
  return (
    <section className="night -mt-[4.25rem] pt-[4.25rem]" aria-labelledby="hero-title">
      <div className="aurora" aria-hidden="true" />
      <div className="guilloche" aria-hidden="true" />
      <div className="mx-auto grid min-h-[88svh] max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
        <div className="grid gap-6">
          <p className="eyebrow rise">{t('app.institutionName')}</p>
          <h1 id="hero-title" className="display rise rise-d1 text-white">
            <span className="block">{t('home.hero.title1')}</span>
            <span className="text-brass block">{t('home.hero.title2')}</span>
          </h1>
          <p className="lede rise rise-d2 max-w-2xl text-navy-100">{t('home.intro')}</p>
          <div className="rise rise-d3 flex flex-wrap gap-3">
            <Link href="/request" className="btn btn-gold min-h-12 px-6 text-base">
              <ScrollText className="size-5" aria-hidden="true" />
              {t('home.hero.ctaRequest')}
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/login" className="btn btn-glass min-h-12 px-6 text-base">
              <UserRound className="size-5" aria-hidden="true" />
              {t('home.hero.ctaLawyer')}
            </Link>
          </div>
          <ul className="rise rise-d4 flex flex-wrap gap-2 pt-2">
            {chips.map((chip) => (
              <li
                key={chip.text}
                className="glass flex items-center gap-2 rounded-full px-4 py-2 text-sm text-navy-100"
              >
                <chip.icon className="size-4 text-gold-300" aria-hidden="true" />
                {chip.text}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="rise rise-d2 relative mx-auto grid aspect-square w-full max-w-[17rem] place-items-center sm:max-w-[26rem]"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 400 400"
            className="animate-orbit absolute inset-0 size-full text-gold-300/60"
          >
            <circle
              cx="200"
              cy="200"
              r="196"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="2 10"
            />
            <circle cx="200" cy="4" r="5" fill="currentColor" />
          </svg>
          <svg
            viewBox="0 0 400 400"
            className="animate-orbit-reverse absolute inset-[9%] size-[82%] text-cedar-300/50"
          >
            <circle
              cx="200"
              cy="200"
              r="196"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeDasharray="40 14 4 14"
            />
            <circle cx="396" cy="200" r="4" fill="currentColor" />
          </svg>
          <div className="glass grid size-[58%] place-items-center rounded-full shadow-[0_0_120px_-20px_rgb(201_165_74/0.55)]">
            <Seal id="hero" className="animate-float size-[78%] text-gold-300" />
          </div>
        </div>
      </div>
      <a
        href="#services"
        className="no-print mx-auto mb-6 flex w-fit flex-col items-center gap-1 text-xs text-navy-200 hover:text-white"
      >
        {t('home.hero.scroll')}
        <ChevronDown className="animate-float size-5" aria-hidden="true" />
      </a>
    </section>
  );
}
