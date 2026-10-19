import Link from 'next/link';

import { Seal } from '@/components/Seal';
import { t } from '@/i18n';

/** Shared footer of the public pages. */
export function SiteFooter() {
  return (
    <footer className="night no-print mt-16">
      <div className="guilloche" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <div className="flex items-center gap-3">
            <Seal id="footer" className="size-14 text-gold-300" />
            <div>
              <p className="text-sm text-navy-200">{t('app.institutionName')}</p>
              <p className="text-lg font-bold text-white">{t('app.systemName')}</p>
            </div>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-navy-200">{t('site.footer.about')}</p>
        </div>
        <nav aria-label={t('site.footer.services')} className="grid content-start gap-2 text-sm">
          <p className="mb-1 font-bold text-gold-300">{t('site.footer.services')}</p>
          <Link href="/request" className="text-navy-100 hover:text-white">
            {t('home.services.audienceRequest')}
          </Link>
          <Link href="/login" className="text-navy-100 hover:text-white">
            {t('home.services.lawyerPortal')}
          </Link>
          <Link href="/login" className="text-navy-100 hover:text-white">
            {t('site.signIn')}
          </Link>
        </nav>
        <nav aria-label={t('site.footer.guide')} className="grid content-start gap-2 text-sm">
          <p className="mb-1 font-bold text-gold-300">{t('site.footer.guide')}</p>
          <Link href="/#journey" className="text-navy-100 hover:text-white">
            {t('site.nav.journey')}
          </Link>
          <Link href="/#roles" className="text-navy-100 hover:text-white">
            {t('site.nav.roles')}
          </Link>
          <Link href="/#guarantees" className="text-navy-100 hover:text-white">
            {t('site.nav.guarantees')}
          </Link>
          <Link href="/#faq" className="text-navy-100 hover:text-white">
            {t('site.nav.faq')}
          </Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-xs text-navy-200 sm:px-6">
          {t('site.footer.note')}
        </p>
      </div>
    </footer>
  );
}
