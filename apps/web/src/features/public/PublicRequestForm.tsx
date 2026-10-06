'use client';

import { PUBLIC_REQUESTER_TYPES, type MeetingMode } from '@sba/shared';
import { CheckCircle2, Send } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';

import { FormError } from '@/components/BookingFields';
import { t } from '@/i18n';
import { api, newIdempotencyKey } from '@/lib/api';
import { formText } from '@/lib/form';

const ENTITIES = ['MINISTRY_OF_JUSTICE', 'SUPREME_JUDICIAL_COUNCIL'] as const;

/**
 * Tier 1 intake: anyone may ask for an audience. The request is only received
 * (PENDING_REVIEW); nothing about the Grand Syndic's availability is shown,
 * and the answer comes later from the Secretariat.
 */
export function PublicRequestForm({ disabled }: { readonly disabled: boolean }) {
  // One key per filled-in form: a retry after a network error cannot create a duplicate.
  const [key, setKey] = useState(newIdempotencyKey);
  const [type, setType] = useState<(typeof PUBLIC_REQUESTER_TYPES)[number]>('CITIZEN');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || busy) return;
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => formText(form, name) || undefined;
    const mode = formText(form, 'mode');
    setBusy(true);
    setError(null);
    const result = await api.post<{ referenceCode: string }>(
      '/public/audience-requests',
      {
        requesterType: type,
        requesterFullName: formText(form, 'name'),
        officialCapacity: formText(form, 'capacity'),
        organizationName: optional('organization'),
        externalEntityCode: optional('entity'),
        contactPhone: formText(form, 'phone').replace(/\s/g, ''),
        contactEmail: optional('email'),
        purpose: formText(form, 'purpose'),
        preferredMeetingMode: mode ? (mode as MeetingMode) : undefined,
        expectedAttendees: Number(formText(form, 'attendees') || '1'),
      },
      { idempotencyKey: key, noRefresh: true },
    );
    setBusy(false);
    if (result.ok) setReference(result.value.referenceCode);
    else setError(result.fields?.length ? t('request.checkFields') : result.message);
  }

  if (reference) {
    return (
      <section className="card grid justify-items-center gap-4 p-8 text-center" role="status">
        <CheckCircle2 className="size-12 text-tier-standard" aria-hidden="true" />
        <h2 className="text-xl font-bold">{t('request.receivedTitle')}</h2>
        <p className="text-ink-muted">{t('request.referenceLabel')}</p>
        <p dir="ltr" className="rounded-2xl bg-navy-50 px-6 py-3 font-mono text-2xl font-bold">
          {reference}
        </p>
        <p className="max-w-prose leading-relaxed">{t('request.receivedBody')}</p>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setReference(null);
            setKey(newIdempotencyKey());
          }}
        >
          {t('request.another')}
        </button>
      </section>
    );
  }

  const institutional = type === 'STATE_INSTITUTION' || type === 'JUDICIAL_AUTHORITY';

  return (
    <form className="card grid gap-4 p-5 sm:p-8" onSubmit={(event) => void submit(event)}>
      <fieldset disabled={disabled || busy} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="type" className="field-label">
              {t('request.type')}
            </label>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(event) => {
                setType(event.target.value as typeof type);
              }}
              className="input"
            >
              {PUBLIC_REQUESTER_TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`labels.requesterType.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="name" className="field-label">
              {t('request.name')}
            </label>
            <input id="name" name="name" required minLength={2} maxLength={120} className="input" />
          </div>
          <div>
            <label htmlFor="capacity" className="field-label">
              {t('request.capacity')}
            </label>
            <input
              id="capacity"
              name="capacity"
              required
              minLength={2}
              maxLength={120}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="organization" className="field-label">
              {t('request.organization')}
            </label>
            <input id="organization" name="organization" maxLength={160} className="input" />
          </div>
          {institutional && (
            <div className="sm:col-span-2">
              <label htmlFor="entity" className="field-label">
                {t('request.entity')}
              </label>
              <select id="entity" name="entity" defaultValue="" className="input">
                <option value="">{t('request.entityNone')}</option>
                {ENTITIES.map((code) => (
                  <option key={code} value={code}>
                    {t(`entities.${code}`)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="phone" className="field-label">
              {t('request.phone')}
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              dir="ltr"
              required
              pattern="\+[1-9][0-9]{7,14}"
              placeholder="+9639XXXXXXXX"
              autoComplete="tel"
              className="input"
            />
          </div>
          <div>
            <label htmlFor="email" className="field-label">
              {t('request.email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              dir="ltr"
              maxLength={254}
              autoComplete="email"
              className="input"
            />
          </div>
        </div>
        <div>
          <label htmlFor="purpose" className="field-label">
            {t('request.purpose')}
          </label>
          <textarea
            id="purpose"
            name="purpose"
            rows={5}
            required
            minLength={10}
            maxLength={2000}
            className="input"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="mode" className="field-label">
              {t('request.mode')}
            </label>
            <select id="mode" name="mode" defaultValue="" className="input">
              <option value="">{t('request.modeAny')}</option>
              {(['IN_PERSON', 'REMOTE'] as const).map((value) => (
                <option key={value} value={value}>
                  {t(`meetingMode.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="attendees" className="field-label">
              {t('request.attendees')}
            </label>
            <input
              id="attendees"
              name="attendees"
              type="number"
              min={1}
              max={50}
              defaultValue={1}
              className="input"
            />
          </div>
        </div>
        <p className="rounded-xl bg-navy-50 p-3 text-sm leading-relaxed text-navy-800">
          {t('request.notice')}
        </p>
        <FormError message={error} />
        <button type="submit" className="btn btn-primary">
          <Send className="size-5" aria-hidden="true" />
          {busy ? t('common.loading') : t('request.submit')}
        </button>
      </fieldset>
    </form>
  );
}
