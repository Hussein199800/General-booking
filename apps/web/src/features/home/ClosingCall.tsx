import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { t } from '@/i18n';

export function ClosingCall() {
  return (
    <section aria-labelledby="cta-heading" className="py-20 sm:py-24">
      <div className="shell">
        <div className="hero reveal grid gap-6 p-8 text-center sm:p-14">
          <h2 id="cta-heading" className="display-2">
            {t('home.cta.heading')}
          </h2>
          <p className="lead mx-auto max-w-xl text-white/75">{t('home.cta.body')}</p>
          <Link href="/request" className="btn btn-gold btn-lg justify-self-center">
            {t('home.cta.action')}
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
