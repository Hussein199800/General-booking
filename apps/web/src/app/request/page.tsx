import { EyeOff, Gavel, Hash } from 'lucide-react';
import type { Metadata } from 'next';

import { PreviewBanner } from '@/components/PreviewBanner';
import { PublicShell } from '@/components/site/PublicShell';
import { PublicRequestForm } from '@/features/public/PublicRequestForm';
import { formatNumber, t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

export const metadata: Metadata = { title: t('request.title') };

const STEPS = ['s2', 's3', 's4', 's5'] as const;

export default function RequestPage() {
  return (
    <PublicShell width="max-w-6xl">
      <section className="hero grid gap-3 p-7 sm:p-10">
        <div className="aurora opacity-50" aria-hidden="true" />
        <p className="eyebrow relative">{t('home.bento.eyebrow')}</p>
        <h1 className="headline relative text-white">{t('request.title')}</h1>
        <p className="lede relative max-w-2xl text-navy-100">{t('request.subtitle')}</p>
      </section>
      {DEMO_MODE && (
        <>
          <PreviewBanner />
          <p className="rounded-xl bg-gold-50 p-3 text-sm text-gold-700">
            {t('request.previewDisabled')}
          </p>
        </>
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <PublicRequestForm disabled={DEMO_MODE} />
        <aside className="grid gap-4 lg:sticky lg:top-24" aria-labelledby="next-steps">
          <section className="card grid gap-4 p-6">
            <h2 id="next-steps" className="text-lg font-bold">
              {t('request.nextSteps')}
            </h2>
            <ol className="grid gap-4">
              {STEPS.map((step, index) => (
                <li key={step} className="grid grid-cols-[auto_1fr] gap-3">
                  <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-sm font-bold text-midnight-900">
                    {formatNumber(index + 1)}
                  </span>
                  <span>
                    <span className="block font-bold">{t(`home.journey.${step}.title`)}</span>
                    <span className="block text-sm text-ink-muted">
                      {t(`home.journey.${step}.body`)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
          <ul className="card grid gap-3 p-6 text-sm">
            {[
              { icon: Gavel, text: t('home.guarantees.g1.body') },
              { icon: EyeOff, text: t('home.guarantees.g4.body') },
              { icon: Hash, text: t('request.keepReference') },
            ].map((item) => (
              <li key={item.text} className="flex gap-3">
                <item.icon className="mt-0.5 size-5 shrink-0 text-cedar-600" aria-hidden="true" />
                <span className="text-ink-muted">{item.text}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PublicShell>
  );
}
