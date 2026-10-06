import ar from '../locales/ar.json' with { type: 'json' };

import { DISPLAY_LOCALE, DISPLAY_TIME_ZONE } from './domain/scheduling.js';

export type Messages = typeof ar;

type LeafKeys<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : LeafKeys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every translatable string, e.g. `errors.notFound` or `governorates.ALEPPO`. */
export type MessageKey = LeafKeys<Messages>;

export type MessageParams = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

function lookup(key: string): string {
  let node: unknown = ar;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null || !(segment in node)) {
      throw new Error(`Missing translation key: ${key}`);
    }
    node = (node as Record<string, unknown>)[segment];
  }
  if (typeof node !== 'string') {
    throw new Error(`Translation key is not a leaf string: ${key}`);
  }
  return node;
}

/**
 * Resolves an Arabic message and interpolates `{{name}}` placeholders.
 *
 * A missing parameter throws rather than leaking a raw placeholder into an
 * official SMS or letter. Values are inserted verbatim: callers rendering HTML
 * (e.g. email bodies) must escape the result.
 */
export function t(key: MessageKey, params: MessageParams = {}): string {
  return interpolate(lookup(key), params, key);
}

/**
 * The stored template text with its `{{placeholders}}` intact — for copying
 * templates elsewhere (e.g. notification_templates), not for display.
 */
export function rawMessage(key: MessageKey): string {
  return lookup(key);
}

/**
 * Fills `{{name}}` placeholders in any template (also used for stored
 * notification templates). Throws on a missing parameter.
 */
export function interpolate(template: string, params: MessageParams, context = 'template'): string {
  return template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing parameter "${name}" for ${context}`);
    }
    return String(value);
  });
}

/** Names of the `{{placeholders}}` a template uses, in order of first appearance. */
export function placeholdersOf(template: string): string[] {
  return [...new Set(Array.from(template.matchAll(PLACEHOLDER), (match) => match[1] ?? ''))];
}

const dateTimeFormatter = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
  timeZone: DISPLAY_TIME_ZONE,
  dateStyle: 'full',
  timeStyle: 'short',
});

/** Formats a UTC instant for display in Damascus local time. */
export function formatDateTime(instant: Date): string {
  return dateTimeFormatter.format(instant);
}
