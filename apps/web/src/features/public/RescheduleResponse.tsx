'use client';

import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { useEffect, useState, type SubmitEvent } from 'react';

import { FormError } from '@/components/BookingFields';
import { t } from '@/i18n';
import { api } from '@/lib/api';
import { formText } from '@/lib/form';

const TOKEN = /^[A-Za-z0-9_-]{20,100}$/;

/**
 * Landing page of the apology message after an emergency postponement. The
 * single-use token travels in the URL fragment (never sent to servers or
 * logs); the visitor only confirms they want a new date — no free slots are
 * shown (hard rule 2). The Secretariat then proposes a time.
 */
export function RescheduleResponse({ disabled }: { readonly disabled: boolean }) {
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<'form' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const value = window.location.hash.slice(1);
    setToken(TOKEN.test(value) ? value : '');
    // Drop the token from the address bar and history once read.
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    const preference = formText(new FormData(event.currentTarget), 'preference');
    setBusy(true);
    const result = await api.post(`/public/reschedule/${token}`, preference ? { preference } : {}, {
      noRefresh: true,
    });
    setBusy(false);
    if (result.ok) setState('done');
    else setError(result.message);
  }

  if (token === null) return null;
  if (token === '') {
    return <p className="card p-6 text-center">{t('errors.linkInvalid')}</p>;
  }
  if (state === 'done') {
    return (
      <section className="card grid justify-items-center gap-3 p-8 text-center" role="status">
        <CheckCircle2 className="size-12 text-tier-standard" aria-hidden="true" />
        <h2 className="text-xl font-bold">{t('reschedule.doneTitle')}</h2>
        <p className="max-w-prose leading-relaxed">{t('reschedule.doneBody')}</p>
      </section>
    );
  }
  return (
    <form className="card grid gap-4 p-6" onSubmit={(event) => void submit(event)}>
      <p className="flex items-start gap-3 leading-relaxed">
        <CalendarClock className="mt-1 size-6 shrink-0 text-navy-700" aria-hidden="true" />
        {t('reschedule.body')}
      </p>
      <div>
        <label htmlFor="preference" className="field-label">
          {t('reschedule.preference')}
        </label>
        <textarea
          id="preference"
          name="preference"
          rows={3}
          maxLength={500}
          placeholder={t('reschedule.preferenceHint')}
          className="input"
        />
      </div>
      <FormError message={error} />
      <button type="submit" className="btn btn-primary" disabled={disabled || busy}>
        {busy ? t('common.loading') : t('reschedule.confirm')}
      </button>
    </form>
  );
}
