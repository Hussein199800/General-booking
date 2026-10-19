import { CalendarClock, FileLock2, Gavel, LayoutDashboard, Lock, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PreviewBanner } from '@/components/PreviewBanner';
import { SiteHeader } from '@/components/site/SiteHeader';
import { Seal } from '@/components/Seal';
import { LoginForm } from '@/features/auth/LoginForm';
import { t } from '@/i18n';
import { DEMO_MODE } from '@/lib/runtime';
import { Loading } from '@/lib/session';

export const metadata: Metadata = { title: t('login.title') };

/**
 * Sign-in for staff and lawyers, laid out like the reference portal (art panel
 * + form). In the static preview there is no server, so the form is inert and
 * the demo screens are linked instead.
 */
export default function LoginPage() {
  return (
    <div className="night flex min-h-dvh flex-col">
      <div className="aurora" aria-hidden="true" />
      <div className="guilloche" aria-hidden="true" />
      <SiteHeader tone="night" />
      <main id="main" className="grid flex-1 place-items-center p-4 sm:p-8">
        <div className="rise grid w-full max-w-5xl gap-4">
          {DEMO_MODE && <PreviewBanner />}
          <div className="grid overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-raised)] md:grid-cols-[0.95fr_1.05fr]">
            <section className="glass flex flex-col justify-center gap-6 rounded-none border-0 p-8 sm:p-10">
              <Seal id="login" className="animate-float size-24 text-gold-300" />
              <div>
                <p className="eyebrow">{t('app.institutionName')}</p>
                <h2 className="mt-2 text-3xl font-bold text-white">{t('login.artTitle')}</h2>
              </div>
              <ul className="grid gap-3 text-navy-100">
                {[
                  { icon: Gavel, text: t('home.trust.human') },
                  { icon: FileLock2, text: t('home.trust.encrypted') },
                  { icon: ShieldCheck, text: t('home.trust.audit') },
                ].map((point) => (
                  <li key={point.text} className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/10">
                      <point.icon className="size-5 text-gold-300" aria-hidden="true" />
                    </span>
                    {point.text}
                  </li>
                ))}
              </ul>
            </section>

            <section className="grid gap-5 bg-surface p-6 text-ink sm:p-10">
              <div>
                <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-navy-800 via-navy-700 to-cedar-700 text-gold-300 shadow-lg">
                  <Lock className="size-7" aria-hidden="true" />
                </span>
                <h1 className="mt-4 text-3xl font-bold">{t('login.title')}</h1>
                <p className="text-ink-muted">{t('login.subtitle')}</p>
              </div>

              <Suspense fallback={<Loading />}>
                <LoginForm disabled={DEMO_MODE} />
              </Suspense>

              {DEMO_MODE && (
                <div id="login-preview-note" className="grid gap-3 rounded-2xl bg-navy-50 p-4">
                  <p className="text-sm text-ink-muted">{t('login.previewNotice')}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Link href="/secretariat" className="btn btn-secondary">
                      <LayoutDashboard className="size-5" aria-hidden="true" />
                      {t('login.enterSecretariat')}
                    </Link>
                    <Link href="/syndic" className="btn btn-secondary">
                      <CalendarClock className="size-5" aria-hidden="true" />
                      {t('login.enterSyndic')}
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
