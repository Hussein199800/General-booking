import { Plus } from 'lucide-react';

import { t } from '@/i18n';

import { PrintExpander } from './PrintExpander';

const QUESTIONS = ['1', '2', '3', '4', '5', '6', '7'] as const;

/** Native <details>: opens without JavaScript, and every answer is printed. */
export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="section-white py-20 sm:py-28">
      <div className="shell grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <header className="reveal grid content-start gap-4">
          <p className="eyebrow justify-self-start">{t('home.faq.eyebrow')}</p>
          <h2 id="faq-heading" className="display-2">
            {t('home.faq.heading')}
          </h2>
        </header>
        <div className="grid content-start gap-3">
          {QUESTIONS.map((n) => (
            <details key={n} className="faq-item reveal" data-print-open="">
              <summary>
                {t(`home.faq.q${n}`)}
                <span className="faq-icon grid size-8 place-items-center rounded-full bg-olive-50 text-olive-700">
                  <Plus className="size-4" aria-hidden="true" />
                </span>
              </summary>
              <p>{t(`home.faq.a${n}`)}</p>
            </details>
          ))}
        </div>
      </div>
      <PrintExpander />
    </section>
  );
}
