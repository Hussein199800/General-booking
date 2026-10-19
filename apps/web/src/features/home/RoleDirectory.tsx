'use client';

import { matchesQuery, matchRanges } from '@sba/shared';
import { Search, SearchX } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';

import { t } from '@/i18n';

import { ROLE_CATEGORIES, ROLES, type RoleCategory, type RoleEntry } from './roles';

type Filter = RoleCategory | 'ALL';

const TASKS = ['task1', 'task2', 'task3'] as const;

interface RoleText {
  readonly entry: RoleEntry;
  readonly title: string;
  readonly summary: string;
  readonly tasks: readonly string[];
  readonly category: string;
  readonly haystack: string;
}

const TEXTS: readonly RoleText[] = ROLES.map((entry) => {
  const title = t(`home.directory.roles.${entry.key}.title`);
  const summary = t(`home.directory.roles.${entry.key}.summary`);
  const tasks = TASKS.map((task) => t(`home.directory.roles.${entry.key}.${task}`));
  const category = t(`home.directory.categories.${entry.category}`);
  return {
    entry,
    title,
    summary,
    tasks,
    category,
    haystack: [title, summary, category, ...tasks].join(' '),
  };
});

/** `text` with every match of `query` wrapped in <mark>. */
function Highlight({ text, query }: { readonly text: string; readonly query: string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const { start, end } of matchRanges(text, query)) {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={start} className="hit">
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/**
 * Searchable, filterable directory of roles. Every entry is rendered on the
 * server, so the full list is readable without JavaScript; search and filters
 * only narrow it down.
 */
export function RoleDirectory() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const searchId = useId();

  const visible = useMemo(
    () =>
      TEXTS.filter(
        (role) =>
          (filter === 'ALL' || role.entry.category === filter) &&
          matchesQuery(role.haystack, query),
      ),
    [query, filter],
  );

  return (
    <div className="grid gap-6">
      <div className="reveal grid gap-4">
        <label htmlFor={searchId} className="sr-only">
          {t('home.directory.searchLabel')}
        </label>
        <div className="search-field">
          <Search className="size-5" aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            className="input"
            value={query}
            placeholder={t('home.directory.searchPlaceholder')}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </div>
        <div
          role="group"
          aria-label={t('home.directory.filterLabel')}
          className="flex flex-wrap gap-2"
        >
          {(['ALL', ...ROLE_CATEGORIES] as const).map((category) => (
            <button
              key={category}
              type="button"
              className="chip"
              aria-pressed={filter === category}
              onClick={() => {
                setFilter(category);
              }}
            >
              {t(`home.directory.categories.${category}`)}
            </button>
          ))}
        </div>
        <p role="status" aria-live="polite" className="text-sm text-ink-muted">
          {t('home.directory.results', { count: visible.length })}
        </p>
      </div>

      {visible.length === 0 ? (
        <div className="card grid justify-items-center gap-3 p-10 text-center">
          <SearchX className="size-10 text-ink-subtle" aria-hidden="true" />
          <p className="max-w-md font-bold">{t('home.directory.empty')}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setQuery('');
              setFilter('ALL');
            }}
          >
            {t('home.directory.reset')}
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {visible.map((role) => (
            <li
              key={role.entry.key}
              className="card grid content-start gap-4 p-6"
              data-role={role.entry.key}
            >
              <div className="flex items-start gap-4">
                <span className="step-number shrink-0">
                  <role.entry.icon className="size-5" aria-hidden="true" />
                </span>
                <div className="grid min-w-0 gap-1">
                  <span className="badge justify-self-start bg-navy-50 text-navy-700">
                    <Highlight text={role.category} query={query} />
                  </span>
                  <h3 className="text-lg font-bold">
                    <Highlight text={role.title} query={query} />
                  </h3>
                  <p className="text-ink-muted">
                    <Highlight text={role.summary} query={query} />
                  </p>
                </div>
              </div>
              <ul className="grid gap-2 border-t border-line pt-4 text-sm leading-relaxed">
                {role.tasks.map((task) => (
                  <li key={task} className="flex gap-2">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-500"
                      aria-hidden="true"
                    />
                    <span>
                      <Highlight text={task} query={query} />
                    </span>
                  </li>
                ))}
              </ul>
              {role.entry.apiOnly && (
                <p className="rounded-xl bg-surface-muted px-3 py-2 text-xs text-ink-muted">
                  {t('home.directory.noScreen')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
