import { Bell, CalendarCheck, FileSearch, Scale, Send } from 'lucide-react';

import { Reveal } from '@/components/Reveal';
import { formatNumber, t } from '@/i18n';

import { SectionHeading } from './SectionHeading';

const STEPS = [
  { key: 's1', icon: Send },
  { key: 's2', icon: FileSearch },
  { key: 's3', icon: Scale },
  { key: 's4', icon: Bell },
  { key: 's5', icon: CalendarCheck },
] as const;

/** The request lifecycle as a numbered path that draws itself on scroll. */
export function Journey() {
  return (
    <section
      id="journey"
      className="border-y border-line bg-gradient-to-b from-surface to-canvas"
      aria-labelledby="journey-title"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6">
        <SectionHeading
          id="journey-title"
          eyebrow={t('home.journey.eyebrow')}
          title={t('home.journey.title')}
          lede={t('home.journey.lede')}
        />
        <Reveal as="ol" className="relative grid gap-6 lg:grid-cols-5 lg:gap-4">
          <span
            className="timeline-line absolute inset-x-[10%] top-8 hidden h-0.5 bg-gradient-to-l from-gold-500 via-cedar-500 to-plum-500 lg:block"
            aria-hidden="true"
          />
          {STEPS.map((step, index) => (
            <li
              key={step.key}
              className="relative grid grid-cols-[auto_1fr] gap-4 lg:grid-cols-1 lg:justify-items-center lg:text-center"
            >
              <span className="relative z-10 grid size-16 place-items-center rounded-2xl border border-line bg-surface text-navy-800 shadow-[var(--shadow-card)]">
                <step.icon className="size-7" aria-hidden="true" />
                <span className="absolute -top-2 -start-2 grid size-7 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-xs font-bold text-midnight-900">
                  {formatNumber(index + 1)}
                </span>
              </span>
              <span className="grid gap-1">
                <span className="text-lg font-bold">{t(`home.journey.${step.key}.title`)}</span>
                <span className="text-sm leading-relaxed text-ink-muted">
                  {t(`home.journey.${step.key}.body`)}
                </span>
              </span>
            </li>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
