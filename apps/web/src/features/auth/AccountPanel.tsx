'use client';

import { KeyRound, LogOut, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';

import { t } from '@/i18n';
import { api } from '@/lib/api';
import { formText } from '@/lib/form';
import { homeFor, signOut, useMe } from '@/lib/session';

/** Who is signed in, a password change, and sign-out. */
export function AccountPanel() {
  const me = useMe();
  const router = useRouter();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = formText(form, 'newPassword', { trim: false });
    if (newPassword !== formText(form, 'confirmPassword', { trim: false })) {
      setMessage({ ok: false, text: t('account.mismatch') });
      return;
    }
    setBusy(true);
    const result = await api.post('/auth/password', {
      currentPassword: formText(form, 'currentPassword', { trim: false }),
      newPassword,
    });
    setBusy(false);
    if (result.ok) formElement.reset();
    setMessage(
      result.ok
        ? { ok: true, text: t('account.passwordChanged') }
        : { ok: false, text: result.message },
    );
  }

  return (
    <div className="grid gap-5">
      <section className="hero flex flex-wrap items-center gap-4 p-6">
        <UserRound className="relative size-12 text-gold-300" aria-hidden="true" />
        <div className="relative min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{me.fullName}</h1>
          <p className="text-navy-100">
            {me.roles.map((role) => t(`labels.role.${role}`)).join(t('common.listSeparator'))}
          </p>
        </div>
        <div className="relative flex flex-wrap gap-2">
          <Link href={homeFor(me)} className="btn bg-white/10 text-white hover:bg-white/20">
            {t('nav.backHome')}
          </Link>
          <button
            type="button"
            className="btn bg-white/10 text-white hover:bg-white/20"
            onClick={() => void signOut(router)}
          >
            <LogOut className="size-4" aria-hidden="true" />
            {t('nav.signOut')}
          </button>
        </div>
      </section>

      <section className="card grid gap-4 p-6" aria-labelledby="pw-heading">
        <h2 id="pw-heading" className="flex items-center gap-2 text-lg font-bold">
          <KeyRound className="size-5" aria-hidden="true" />
          {t('account.changePassword')}
        </h2>
        <p className="text-sm text-ink-muted">{t('account.passwordRule')}</p>
        <form className="grid gap-3 sm:max-w-md" onSubmit={(event) => void changePassword(event)}>
          {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((name) => (
            <div key={name}>
              <label htmlFor={name} className="field-label">
                {t(`account.${name}`)}
              </label>
              <input
                id={name}
                name={name}
                type="password"
                required
                minLength={name === 'currentPassword' ? 1 : 12}
                autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
                className="input"
              />
            </div>
          ))}
          {message && (
            <p
              role={message.ok ? 'status' : 'alert'}
              className={`rounded-xl p-3 text-sm font-bold ${
                message.ok
                  ? 'bg-tier-standard-bg text-tier-standard'
                  : 'bg-tier-critical-bg text-tier-critical'
              }`}
            >
              {message.text}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {t('account.save')}
          </button>
        </form>
      </section>
    </div>
  );
}
