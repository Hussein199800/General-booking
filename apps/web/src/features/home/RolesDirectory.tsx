'use client';

import { Check, Search, ShieldAlert, X } from 'lucide-react';
import { useDeferredValue, useMemo, useState, type ReactNode } from 'react';

import { t } from '@/i18n';

type Category = 'PUBLIC' | 'LAWYERS' | 'SECRETARIAT' | 'LEADERSHIP' | 'UNITS' | 'OVERSIGHT';
type RoleKey =
  | 'PUBLIC_REQUESTER'
  | 'LAWYER'
  | 'SECRETARIAT_OFFICER'
  | 'SECRETARIAT_HEAD'
  | 'GRAND_SYNDIC'
  | 'COUNCIL_MEMBER'
  | 'UNIT_STAFF'
  | 'SYSTEM_ADMIN'
  | 'AUDITOR';

const CATEGORIES: readonly Category[] = [
  'PUBLIC',
  'LAWYERS',
  'SECRETARIAT',
  'LEADERSHIP',
  'UNITS',
  'OVERSIGHT',
];

const ROLES: readonly { key: RoleKey; category: Category }[] = [
  { key: 'PUBLIC_REQUESTER', category: 'PUBLIC' },
  { key: 'LAWYER', category: 'LAWYERS' },
  { key: 'SECRETARIAT_OFFICER', category: 'SECRETARIAT' },
  { key: 'SECRETARIAT_HEAD', category: 'SECRETARIAT' },
  { key: 'GRAND_SYNDIC', category: 'LEADERSHIP' },
  { key: 'COUNCIL_MEMBER', category: 'LEADERSHIP' },
  { key: 'UNIT_STAFF', category: 'UNITS' },
  { key: 'SYSTEM_ADMIN', category: 'OVERSIGHT' },
  { key: 'AUDITOR', category: 'OVERSIGHT' },
];

const ACCENT: Record<Category, string> = {
  PUBLIC: 'from-sky-500 to-cedar-500',
  LAWYERS: 'from-cedar-600 to-cedar-300',
  SECRETARIAT: 'from-navy-700 to-sky-500',
  LEADERSHIP: 'from-gold-600 to-gold-300',
  UNITS: 'from-plum-500 to-sky-500',
  OVERSIGHT: 'from-ink-muted to-navy-600',
};

// Search folding by code point (no Arabic literals in source; Prettier would
// rewrite \u escapes into raw letters).
const ch = (code: number) => String.fromCharCode(code);
const range = (from: number, to: number) => `${ch(from)}-${ch(to)}`;
const MARKS = new RegExp(`[${range(0x064b, 0x065f)}${ch(0x0670)}${ch(0x0640)}]`, 'g');
const ALEF_FORMS = new RegExp(`[${ch(0x0622)}${ch(0x0623)}${ch(0x0625)}]`, 'g');
const ALEF_MAQSURA = new RegExp(ch(0x0649), 'g');
const TAA_MARBUTA = new RegExp(ch(0x0629), 'g');

/** Arabic search folding: ignore diacritics, tatweel and alef/yaa/taa-marbuta variants. */
function fold(text: string): string {
  return text
    .normalize('NFKD')
    .replace(MARKS, '')
    .replace(ALEF_FORMS, ch(0x0627))
    .replace(ALEF_MAQSURA, ch(0x064a))
    .replace(TAA_MARBUTA, ch(0x0647))
    .toLowerCase();
}

function texts(key: RoleKey) {
  const base = `home.roles.items.${key}` as const;
  return {
    title: t(`${base}.title`),
    summary: t(`${base}.summary`),
    duties: [t(`${base}.d1`), t(`${base}.d2`), t(`${base}.d3`), t(`${base}.d4`)],
    limit: t(`${base}.limit`),
  };
}

/** Marks the parts of `text` that match `query` (after folding). */
function highlight(text: string, query: string): ReactNode {
  if (!query) return text;
  const folded = fold(text);
  const needle = fold(query);
  // Folding can change lengths (decomposed letters), so only highlight when it does not.
  if (folded.length !== text.length) return text;
  const parts: ReactNode[] = [];
  let from = 0;
  for (
    let at = folded.indexOf(needle);
    at !== -1;
    at = folded.indexOf(needle, at + needle.length)
  ) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} className="hit">
        {text.slice(at, at + needle.length)}
      </mark>,
    );
    from = at + needle.length;
  }
  if (parts.length === 0) return text;
  parts.push(text.slice(from));
  return parts;
}

/**
 * "Who does what": every role's powers and limits, searchable (Arabic-aware)
 * and filterable by category — the system's responsibilities at a glance.
 */
export function RolesDirectory() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | 'ALL'>('ALL');
  const deferred = useDeferredValue(query.trim());

  const entries = useMemo(() => ROLES.map((role) => ({ ...role, ...texts(role.key) })), []);
  const visible = entries.filter((entry) => {
    if (category !== 'ALL' && entry.category !== category) return false;
    if (!deferred) return true;
    const needle = fold(deferred);
    return [entry.title, entry.summary, entry.limit, ...entry.duties].some((part) =>
      fold(part).includes(needle),
    );
  });

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-center">
        <div className="relative">
          <label htmlFor="roles-search" className="sr-only">
            {t('home.roles.search')}
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-ink-subtle"
            aria-hidden="true"
          />
          <input
            id="roles-search"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            placeholder={t('home.roles.searchPlaceholder')}
            className="input min-h-13 rounded-full ps-12 pe-12 text-base shadow-[var(--shadow-card)]"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              className="absolute inset-y-0 end-3 my-auto grid size-8 place-items-center rounded-full text-ink-subtle hover:bg-canvas"
              aria-label={t('home.roles.clear')}
              onClick={() => {
                setQuery('');
              }}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t('home.roles.eyebrow')}>
          {(['ALL', ...CATEGORIES] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={category === value}
              onClick={() => {
                setCategory(value);
              }}
            >
              {value === 'ALL' ? t('home.roles.all') : t(`home.roles.categories.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-ink-subtle" role="status" aria-live="polite">
        {t('home.roles.count', { count: visible.length })}
      </p>

      {visible.length === 0 ? (
        <p className="card p-10 text-center text-ink-muted">{t('home.roles.empty')}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((entry) => (
            <li
              key={entry.key}
              className="card card-link relative grid content-start gap-4 overflow-hidden p-6"
            >
              <span
                className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${ACCENT[entry.category]}`}
                aria-hidden="true"
              />
              <div className="grid gap-1">
                <span className="text-xs font-bold text-ink-subtle">
                  {t(`home.roles.categories.${entry.category}`)}
                </span>
                <h3 className="text-xl font-bold">{highlight(entry.title, deferred)}</h3>
                <p className="text-sm text-ink-muted">{highlight(entry.summary, deferred)}</p>
              </div>
              <ul className="grid gap-2 text-sm">
                {entry.duties.map((duty) => (
                  <li key={duty} className="flex gap-2">
                    <Check className="mt-1 size-4 shrink-0 text-cedar-600" aria-hidden="true" />
                    <span>{highlight(duty, deferred)}</span>
                  </li>
                ))}
              </ul>
              <p className="flex gap-2 rounded-xl bg-canvas p-3 text-sm text-ink-muted">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-gold-600" aria-hidden="true" />
                <span>
                  <span className="font-bold text-ink">{t('home.roles.limit')}: </span>
                  {highlight(entry.limit, deferred)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
