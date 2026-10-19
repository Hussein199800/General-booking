import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/Reveal';
import { t } from '@/i18n';

import { SectionHeading } from './SectionHeading';

const QUESTIONS = ['1', '2', '3', '4', '5', '6'] as const;

/** Short answers on native <details> (keyboard and screen-reader friendly). */
export function Faq() {
  return (
    <section
      id="faq"
      className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[0.8fr_1.2fr]"
      aria-labelledby="faq-title"
    >
      <div className="self-start lg:sticky lg:top-28">
        <SectionHeading
          id="faq-title"
          eyebrow={t('home.faq.eyebrow')}
          title={t('home.faq.title')}
          lede={t('home.faq.lede')}
        />
        <Link href="/request" className="btn btn-primary mt-6">
          {t('home.hero.ctaRequest')}
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <Reveal className="grid gap-3">
        {QUESTIONS.map((n) => (
          <details key={n} className="faq card group overflow-hidden">
            <summary className="flex items-center gap-4 p-5 text-lg font-bold hover:text-navy-700">
              <span className="flex-1">{t(`home.faq.q${n}`)}</span>
              <span className="faq-icon grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-navy-800">
                <Plus className="size-5" aria-hidden="true" />
              </span>
            </summary>
            <p className="px-5 pb-5 leading-relaxed text-ink-muted">{t(`home.faq.a${n}`)}</p>
          </details>
        ))}
      </Reveal>
    </section>
  );
}
