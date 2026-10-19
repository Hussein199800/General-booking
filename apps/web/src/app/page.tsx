import { ArrowLeft, CalendarClock, LayoutDashboard, LogIn, UserRoundCheck } from 'lucide-react';
import Link from 'next/link';

import { Reveal } from '@/components/Reveal';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Faq } from '@/features/home/Faq';
import { Guarantees } from '@/features/home/Guarantees';
import { HomeHero } from '@/features/home/HomeHero';
import { Journey } from '@/features/home/Journey';
import { RolesDirectory } from '@/features/home/RolesDirectory';
import { SectionHeading } from '@/features/home/SectionHeading';
import { ServicesBento } from '@/features/home/ServicesBento';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';

const previews = [
  {
    href: '/secretariat',
    icon: LayoutDashboard,
    title: t('home.previewLinks.secretariat'),
    description: t('home.previewLinks.secretariatDesc'),
  },
  {
    href: '/syndic',
    icon: CalendarClock,
    title: t('home.previewLinks.syndic'),
    description: t('home.previewLinks.syndicDesc'),
  },
  {
    href: '/member',
    icon: UserRoundCheck,
    title: t('home.previewLinks.member'),
    description: t('home.previewLinks.memberDesc'),
  },
  {
    href: '/login',
    icon: LogIn,
    title: t('home.previewLinks.login'),
    description: t('home.previewLinks.loginDesc'),
  },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader tone="night" />
      <main id="main">
        <HomeHero />
        <ServicesBento />

        {DEMO_MODE && (
          <section
            aria-labelledby="preview-heading"
            className="mx-auto max-w-7xl px-4 pb-16 sm:px-6"
          >
            <Reveal className="card grid gap-5 bg-gradient-to-br from-surface to-gold-50 p-6 sm:p-8">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="preview-heading" className="text-2xl font-bold">
                    {t('home.previewHeading')}
                  </h2>
                  <span className="badge bg-gold-100 text-gold-700">{t('preview.badge')}</span>
                </div>
                <p className="mt-1 text-ink-muted">{t('home.previewIntro')}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {previews.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="card card-link group flex items-start gap-3 p-4"
                  >
                    <item.icon
                      className="mt-0.5 size-6 shrink-0 text-navy-700"
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{item.title}</span>
                      <span className="block text-sm text-ink-muted">{item.description}</span>
                    </span>
                    <ArrowLeft
                      className="mt-1 size-5 shrink-0 text-ink-subtle transition group-hover:-translate-x-1"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
              <p className="text-sm text-ink-muted">{t('home.servicesPending')}</p>
            </Reveal>
          </section>
        )}

        <Journey />

        <section
          id="roles"
          className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6"
          aria-labelledby="roles-title"
        >
          <SectionHeading
            id="roles-title"
            eyebrow={t('home.roles.eyebrow')}
            title={t('home.roles.title')}
            lede={t('home.roles.lede')}
          />
          <RolesDirectory />
        </section>

        <Guarantees />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
