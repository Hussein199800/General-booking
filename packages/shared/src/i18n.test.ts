import { describe, expect, it } from 'vitest';

import ar from '../locales/ar.json' with { type: 'json' };
import { ADMINISTRATIVE_ENTITIES } from './domain/administrative-entities.js';
import { GOVERNORATES } from './domain/governorates.js';
import { MEETING_MODES, PRIORITY_TIERS } from './domain/scheduling.js';
import { formatDateTime, rawMessage, t, type MessageKey } from './i18n.js';

describe('t', () => {
  it('resolves nested keys', () => {
    expect(t('governorates.ALEPPO')).toBe(ar.governorates.ALEPPO);
  });

  it('interpolates placeholders', () => {
    const name = t('branch.councilName', { governorate: t('governorates.HOMS') });
    expect(name).toBe(ar.branch.councilName.replace('{{governorate}}', ar.governorates.HOMS));
  });

  it('renders numeric parameters in the display locale digits', () => {
    const expected = new Intl.NumberFormat('ar-SY').format(30);
    expect(t('secretariat.approve.minutes', { count: 30 })).toContain(expected);
  });

  it('throws on a missing placeholder parameter', () => {
    expect(() => t('branch.councilName')).toThrow(/Missing parameter "governorate"/);
  });

  it('returns raw templates with placeholders intact', () => {
    expect(rawMessage('branch.councilName')).toBe(ar.branch.councilName);
  });

  it('throws on an unknown key', () => {
    expect(() => t('errors.doesNotExist' as MessageKey)).toThrow(/Missing translation key/);
  });
});

describe('locale coverage', () => {
  it.each([
    ['entities', ADMINISTRATIVE_ENTITIES],
    ['governorates', GOVERNORATES],
    ['priority', PRIORITY_TIERS],
    ['meetingMode', MEETING_MODES],
  ] as const)('has an Arabic label for every %s code', (section, codes) => {
    expect(Object.keys(ar[section]).sort()).toEqual([...codes].sort());
  });

  it('defines exactly 14 governorates', () => {
    expect(GOVERNORATES).toHaveLength(14);
  });
});

describe('formatDateTime', () => {
  it('renders UTC instants in Damascus local time', () => {
    // 07:00 UTC is 10:00 in Damascus (UTC+3, no DST since 2022).
    const rendered = formatDateTime(new Date('2026-10-06T07:00:00Z'));
    const expected = new Intl.DateTimeFormat('ar-SY', {
      timeZone: 'Asia/Damascus',
      timeStyle: 'short',
    }).format(new Date('2026-10-06T07:00:00Z'));
    expect(rendered).toContain(expected);
  });
});
