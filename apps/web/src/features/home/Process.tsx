import { formatNumber, t } from '@/i18n';

const STEPS = ['step1', 'step2', 'step3', 'step4'] as const;

export function Process() {
  return (
    <section
      id="process"
      aria-labelledby="process-heading"
      className="section-white py-20 sm:py-28"
    >
      <div className="shell grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <header className="reveal grid content-start gap-4 lg:sticky lg:top-28">
          <p className="eyebrow justify-self-start">{t('home.process.eyebrow')}</p>
          <h2 id="process-heading" className="display-2 text-balance">
            {t('home.process.heading')}
          </h2>
        </header>
        <ol className="grid gap-4">
          {STEPS.map((step, index) => (
            <li key={step} className="reveal card flex gap-5 p-6 sm:p-7">
              <span className="step-number shrink-0" aria-hidden="true">
                {formatNumber(index + 1)}
              </span>
              <div className="grid gap-2">
                <h3 className="text-lg font-bold sm:text-xl">{t(`home.process.${step}.title`)}</h3>
                <p className="leading-relaxed text-ink-muted">{t(`home.process.${step}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
