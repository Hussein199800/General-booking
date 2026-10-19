import { DISPLAY_LOCALE } from '@sba/shared';
import Link from 'next/link';

import { t } from '@/i18n';

import { Seal } from './Seal';
import { SITE_SECTIONS } from './site-sections';

/** Footer of the public pages: who we are, services, sections, staff entry. */
export function SiteFooter() {
  // Eastern Arabic digits without a thousands separator.
  const year = new Intl.NumberFormat(DISPLAY_LOCALE, { useGrouping: false }).format(
    new Date().getFullYear(),
  );
  return (
    <footer className="site-footer section-dark">
      <div className="shell grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <div className="flex items-center gap-3">
            <Seal id="site-footer" className="size-14 shrink-0 text-gold-300" />
            <div>
              <p className="font-bold">{t('app.shortName')}</p>
              <p className="text-sm text-white/60">{t('app.institutionName')}</p>
            </div>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-white/70">{t('footer.about')}</p>
        </div>

        <nav aria-labelledby="footer-services" className="grid content-start gap-3 text-sm">
          <h2 id="footer-services" className="font-bold text-gold-300">
            {t('footer.servicesHeading')}
          </h2>
          <Link href="/request">{t('home.services.audience.title')}</Link>
          <Link href="/login?door=lawyer">{t('home.services.lawyer.title')}</Link>
        </nav>

        <nav aria-labelledby="footer-portal" className="grid content-start gap-3 text-sm">
          <h2 id="footer-portal" className="font-bold text-gold-300">
            {t('footer.portalHeading')}
          </h2>
          {SITE_SECTIONS.map((section) => (
            <Link key={section.id} href={`/#${section.id}`}>
              {section.label}
            </Link>
          ))}
        </nav>

        <nav aria-labelledby="footer-staff" className="grid content-start gap-3 text-sm">
          <h2 id="footer-staff" className="font-bold text-gold-300">
            {t('footer.staffHeading')}
          </h2>
          <Link href="/login">{t('nav.login')}</Link>
          <Link href="/secretariat">{t('home.services.secretariat.title')}</Link>
          <Link href="/syndic">{t('home.services.syndic.title')}</Link>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="shell flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-white/55">
          <p>{t('footer.rights', { year })}</p>
          <p>{t('footer.note')}</p>
        </div>
      </div>
    </footer>
  );
}
