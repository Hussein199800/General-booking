'use client';

import { ShieldCheck, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toDataURL } from 'qrcode';
import { useEffect, useState, type SubmitEvent } from 'react';

import { t } from '@/i18n';
import { api } from '@/lib/api';
import { homeFor, Loading, useMe } from '@/lib/session';

interface Enrollment {
  readonly secret: string;
  readonly otpauthUri: string;
}

/**
 * First sign-in of a staff member without a second factor (decision I-6): the
 * session can reach nothing else until a TOTP authenticator is confirmed.
 */
export function MfaEnrollment() {
  const me = useMe();
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me.mfaEnabled) return;
    let cancelled = false;
    void api.post<Enrollment>('/auth/mfa/enroll').then(async (result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEnrollment(result.value);
      setQr(await toDataURL(result.value.otpauthUri, { margin: 1, width: 220 }));
    });
    return () => {
      cancelled = true;
    };
  }, [me.mfaEnabled]);

  if (me.mfaEnabled) {
    return (
      <p className="card p-6 text-center">
        <ShieldCheck className="mx-auto mb-2 size-8 text-tier-standard" aria-hidden="true" />
        {t('mfa.alreadyEnabled')}
      </p>
    );
  }

  async function confirm(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const otp = new FormData(event.currentTarget).get('otp');
    setBusy(true);
    const result = await api.post('/auth/mfa/confirm', { otp });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.replace(homeFor({ ...me, mfaEnabled: true, mfaVerified: true }));
  }

  if (!enrollment && !error) return <Loading />;

  return (
    <section className="card grid gap-5 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Smartphone className="size-8 text-navy-700" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold">{t('mfa.title')}</h1>
          <p className="text-sm text-ink-muted">{t('mfa.subtitle')}</p>
        </div>
      </div>
      {enrollment && (
        <>
          <ol className="grid list-decimal gap-2 ps-5 text-sm leading-relaxed">
            <li>{t('mfa.step1')}</li>
            <li>{t('mfa.step2')}</li>
            <li>{t('mfa.step3')}</li>
          </ol>
          <div className="grid justify-items-center gap-3">
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element -- a local data: URL
              <img src={qr} alt={t('mfa.qrAlt')} width={220} height={220} className="rounded-xl" />
            )}
            <p className="text-xs text-ink-subtle">{t('mfa.manualKey')}</p>
            <code dir="ltr" className="rounded-xl bg-canvas px-4 py-2 font-mono text-sm break-all">
              {enrollment.secret.replace(/(.{4})/g, '$1 ').trim()}
            </code>
          </div>
          <form className="grid gap-3" onSubmit={(event) => void confirm(event)}>
            <label htmlFor="otp" className="field-label">
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
              dir="ltr"
              className="input tracking-[0.4em]"
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {t('mfa.confirm')}
            </button>
          </form>
        </>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-tier-critical-bg p-3 text-sm font-bold text-tier-critical"
        >
          {error}
        </p>
      )}
    </section>
  );
}
