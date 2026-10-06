import { t } from '@/i18n';

export default function HomePage() {
  return (
    <>
      <header className="border-b-4 border-gold-500 bg-navy-900 text-gold-50">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <p className="text-sm tracking-wide text-gold-300">{t('app.institutionName')}</p>
          <h1 className="mt-2 text-3xl font-bold">{t('app.systemName')}</h1>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-2xl font-bold text-navy-900">{t('home.title')}</h2>
        <p className="mt-4 max-w-prose text-lg leading-relaxed">{t('home.intro')}</p>

        <section aria-labelledby="services-heading" className="mt-12">
          <h3 id="services-heading" className="text-xl font-bold text-navy-900">
            {t('home.servicesHeading')}
          </h3>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            <li className="rounded-lg border border-navy-100 bg-white p-6 border-s-4 border-s-gold-500">
              {t('home.services.audienceRequest')}
            </li>
            <li className="rounded-lg border border-navy-100 bg-white p-6 border-s-4 border-s-gold-500">
              {t('home.services.lawyerPortal')}
            </li>
          </ul>
          <p role="status" className="mt-6 text-navy-700">
            {t('home.servicesPending')}
          </p>
        </section>
      </main>
    </>
  );
}
