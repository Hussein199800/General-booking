import {
  CalendarX2,
  EyeOff,
  FileLock2,
  Gavel,
  ScrollText,
  Server,
  ShieldCheck,
} from 'lucide-react';

import { t } from '@/i18n';

const ITEMS = [
  { key: 'human', icon: Gavel },
  { key: 'privacy', icon: EyeOff },
  { key: 'overlap', icon: CalendarX2 },
  { key: 'audit', icon: ScrollText },
  { key: 'access', icon: ShieldCheck },
  { key: 'encryption', icon: FileLock2 },
  { key: 'selfHosted', icon: Server },
] as const;

/** Wide first and last cards keep the grid balanced: 2 + 1, 1 + 1 + 1, 1 + 2 on wide screens. */
const SPAN: Partial<Record<(typeof ITEMS)[number]['key'], string>> = {
  human: 'lg:col-span-2',
  selfHosted: 'sm:col-span-2',
};

export function Guarantees() {
  return (
    <section
      id="guarantees"
      aria-labelledby="guarantees-heading"
      className="section-dark py-20 sm:py-28"
    >
      <div className="aurora" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="shell grid gap-12">
        <header className="reveal grid justify-items-center gap-4 text-center">
          <p className="eyebrow eyebrow-dark">{t('home.guarantees.eyebrow')}</p>
          <h2 id="guarantees-heading" className="display-2 max-w-4xl text-balance">
            {t('home.guarantees.heading')}
          </h2>
        </header>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((item) => (
            <li
              key={item.key}
              className={`reveal glass-card grid content-start gap-3 ${SPAN[item.key] ?? ''}`}
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-white/10 text-gold-300">
                <item.icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className="text-lg font-bold">{t(`home.guarantees.${item.key}.title`)}</h3>
              <p className="leading-relaxed text-white/70">
                {t(`home.guarantees.${item.key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
