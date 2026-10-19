import { t } from '@/i18n';

import { RoleDirectory } from './RoleDirectory';

export function Directory() {
  return (
    <section id="directory" aria-labelledby="directory-heading" className="py-20 sm:py-28">
      <div className="shell grid gap-10">
        <header className="reveal grid justify-items-center gap-4 text-center">
          <p className="eyebrow">{t('home.directory.eyebrow')}</p>
          <h2 id="directory-heading" className="display-2 max-w-3xl text-balance">
            {t('home.directory.heading')}
          </h2>
          <p className="lead max-w-3xl text-ink-muted">{t('home.directory.lead')}</p>
        </header>
        <RoleDirectory />
      </div>
    </section>
  );
}
