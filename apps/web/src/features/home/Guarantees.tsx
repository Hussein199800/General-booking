import { CalendarX2, EyeOff, Fingerprint, Gavel, KeyRound, Link2 } from 'lucide-react';

import { Reveal } from '@/components/Reveal';
import { t } from '@/i18n';

import { SectionHeading } from './SectionHeading';

const ITEMS = [
  { key: 'g1', icon: Gavel },
  { key: 'g2', icon: CalendarX2 },
  { key: 'g3', icon: Link2 },
  { key: 'g4', icon: EyeOff },
  { key: 'g5', icon: Fingerprint },
  { key: 'g6', icon: KeyRound },
] as const;

const MARQUEE = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'] as const;

/** The system's guarantees on a dark, cinematic band, with a slow marquee. */
export function Guarantees() {
  const phrases = MARQUEE.map((key) => t(`home.guarantees.${key}`));
  return (
    <section id="guarantees" className="night" aria-labelledby="guarantees-title">
      <div className="aurora opacity-60" aria-hidden="true" />
      <div className="guilloche" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6">
        <SectionHeading
          id="guarantees-title"
          tone="night"
          eyebrow={t('home.guarantees.eyebrow')}
          title={t('home.guarantees.title')}
          lede={t('home.guarantees.lede')}
        />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item, index) => (
            <Reveal
              as="li"
              key={item.key}
              delay={((index % 3) + 1) as 1 | 2 | 3}
              className="glass group grid content-start gap-3 rounded-[var(--radius-card)] p-6 transition-colors duration-300 hover:bg-white/12"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-gold-400/25 to-cedar-500/25 text-gold-300 ring-1 ring-white/10">
                <item.icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="text-xl font-bold text-white">
                {t(`home.guarantees.${item.key}.title`)}
              </h3>
              <p className="leading-relaxed text-navy-200">
                {t(`home.guarantees.${item.key}.body`)}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
      <div className="marquee border-t border-white/10 py-6" aria-hidden="true">
        {[0, 1].map((copy) => (
          <div key={copy} className="marquee-track">
            {phrases.map((phrase) => (
              <span
                key={phrase}
                className="flex items-center gap-3 text-lg font-bold whitespace-nowrap text-navy-100 sm:text-2xl"
              >
                <span className="size-2 rotate-45 bg-gold-500" />
                {phrase}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
