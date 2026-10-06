import { CalendarClock, FileLock2, Gavel, LayoutDashboard, Lock, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';

import { PreviewBanner } from '@/components/PreviewBanner';
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
    <main id="main" className="grid min-h-dvh place-items-center p-4 sm:p-8">
      <div className="grid w-full max-w-5xl gap-4">
        {DEMO_MODE && <PreviewBanner />}
        <div className="card grid overflow-hidden p-0 md:grid-cols-2">
          <section className="hero flex flex-col justify-center gap-5 rounded-none p-8 shadow-none sm:p-10">
            <Seal id="login" className="relative size-24 text-gold-300" />
            <div className="relative">
              <p className="text-sm text-gold-300">{t('app.institutionName')}</p>
              <h2 className="mt-1 text-2xl font-bold">{t('login.artTitle')}</h2>
            </div>
            <ul className="relative grid gap-3 text-navy-100">
              {[
                { icon: Gavel, text: t('home.trust.human') },
                { icon: FileLock2, text: t('home.trust.encrypted') },
                { icon: ShieldCheck, text: t('home.trust.audit') },
              ].map((point) => (
                <li key={point.text} className="flex items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/10">
                    <point.icon className="size-5 text-gold-300" aria-hidden="true" />
                  </span>
                  {point.text}
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-5 p-6 sm:p-10">
            <div>
              <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-navy-800 to-navy-600 text-gold-300 shadow-lg">
                <Lock className="size-7" aria-hidden="true" />
              </span>
              <h1 className="mt-4 text-2xl font-bold">{t('login.title')}</h1>
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
  );
}
