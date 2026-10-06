'use client';

import { BadgeCheck, IdCard, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type SubmitEvent } from 'react';

import { t } from '@/i18n';
import { api } from '@/lib/api';
import { formText } from '@/lib/form';
import { homeFor, type Me } from '@/lib/session';

type Door = 'STAFF' | 'LAWYER';
type Outcome =
  { status: 'OK' } | { status: 'MFA_REQUIRED' } | { status: 'MFA_ENROLLMENT_REQUIRED' };

/** Only same-site paths are accepted after sign-in (no open redirect). */
function safeNext(value: string | null): string | null {
  return value && /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(value) ? value : null;
}

/**
 * Two doors (decision Q14): staff sign in with e-mail, password and a TOTP
 * code; lawyers with registration number, national ID and password.
 */
export function LoginForm({ disabled }: { readonly disabled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [door, setDoor] = useState<Door>('STAFF');
  const [needOtp, setNeedOtp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const otp = formText(form, 'otp');
    const body =
      door === 'STAFF'
        ? { email: formText(form, 'email'), password: formText(form, 'password', { trim: false }) }
        : {
            registrationNumber: formText(form, 'registrationNumber'),
            nationalId: formText(form, 'nationalId'),
            password: formText(form, 'password', { trim: false }),
          };
    setBusy(true);
    setError(null);
    const result = await api.post<Outcome>(
      door === 'STAFF' ? '/auth/staff/login' : '/auth/lawyer/login',
      needOtp && otp ? { ...body, otp } : body,
      { noRefresh: true },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    switch (result.value.status) {
      case 'MFA_REQUIRED':
        setNeedOtp(true);
        return;
      case 'MFA_ENROLLMENT_REQUIRED':
        router.replace('/account/mfa');
        return;
      case 'OK': {
        const me = await api.get<Me>('/auth/me');
        const next = safeNext(params.get('next'));
        router.replace(next ?? (me.ok ? homeFor(me.value) : '/account'));
      }
    }
  }

  return (
    <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
      <div
        role="tablist"
        aria-label={t('login.title')}
        className="grid grid-cols-2 gap-1 rounded-2xl bg-canvas p-1"
      >
        {(['STAFF', 'LAWYER'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={door === value}
            disabled={disabled}
            onClick={() => {
              setDoor(value);
              setNeedOtp(false);
              setError(null);
            }}
            className={`btn min-h-10 text-sm ${door === value ? 'btn-primary' : 'text-ink-muted'}`}
          >
            {value === 'STAFF' ? t('login.staffDoor') : t('login.lawyerDoor')}
          </button>
        ))}
      </div>

      <fieldset disabled={disabled || busy} className="grid gap-4">
        {door === 'STAFF' ? (
          <div>
            <label htmlFor="email" className="field-label">
              <Mail className="size-4" aria-hidden="true" />
              {t('login.email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              required
              autoComplete="username"
              className="input"
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="registrationNumber" className="field-label">
                <BadgeCheck className="size-4" aria-hidden="true" />
                {t('login.registrationNumber')}
              </label>
              <input
                id="registrationNumber"
                name="registrationNumber"
                dir="ltr"
                required
                autoComplete="username"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="nationalId" className="field-label">
                <IdCard className="size-4" aria-hidden="true" />
                {t('login.nationalId')}
              </label>
              <input
                id="nationalId"
                name="nationalId"
                dir="ltr"
                inputMode="numeric"
                required
                autoComplete="off"
                className="input"
              />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="password" className="field-label">
            <KeyRound className="size-4" aria-hidden="true" />
            {t('login.password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
          />
        </div>
        {needOtp && (
          <div>
            <label htmlFor="otp" className="field-label">
              <ShieldCheck className="size-4" aria-hidden="true" />
              {t('login.otp')}
            </label>
            <input
              id="otp"
              name="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              dir="ltr"
              className="input tracking-[0.4em]"
            />
            <p className="mt-1 text-xs text-ink-subtle">{t('login.otpHint')}</p>
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-tier-critical-bg p-3 text-sm font-bold text-tier-critical"
          >
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary w-full">
          {busy ? t('common.loading') : needOtp ? t('login.verify') : t('login.submit')}
        </button>
      </fieldset>
    </form>
  );
}
