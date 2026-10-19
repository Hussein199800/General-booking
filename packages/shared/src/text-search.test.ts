import { describe, expect, it } from 'vitest';

import { foldArabic, matchesQuery, matchRanges, searchTerms } from './text-search.js';
// Arabic samples live in JSON: source files may not contain Arabic literals.
import fx from './text-search.fixtures.json' with { type: 'json' };

const slice = (text: string, query: string) =>
  matchRanges(text, query).map(({ start, end }) => text.slice(start, end));

describe('foldArabic', () => {
  it('drops diacritics and tatweel', () => {
    expect(foldArabic(fx.diacritics[0] ?? '')).toBe(fx.diacritics[1]);
    expect(foldArabic(fx.tatweel[0] ?? '')).toBe(foldArabic(fx.tatweel[1] ?? ''));
  });

  it.each([fx.hamzaAlef, fx.alefMaqsura, fx.taaMarbuta, fx.hamzaSeats])(
    'unifies letter variants (%s)',
    (input, expected) => {
      expect(foldArabic(input)).toBe(expected);
    },
  );

  it('lower-cases Latin text', () => {
    expect(foldArabic('TOTP')).toBe('totp');
  });
});

describe('matchesQuery', () => {
  it.each(fx.variants)('ignores spelling variants in the query or the text (%s)', (text, query) => {
    expect(matchesQuery(text, query)).toBe(true);
  });

  it('requires every term', () => {
    expect(matchesQuery(fx.allTerms.text, fx.allTerms.yes)).toBe(true);
    expect(matchesQuery(fx.allTerms.text, fx.allTerms.no)).toBe(false);
  });

  it('matches everything for a blank query', () => {
    expect(matchesQuery(fx.blank, '   ')).toBe(true);
    expect(searchTerms('  ')).toEqual([]);
  });
});

describe('matchRanges', () => {
  it('maps matches back to the original text, marks included', () => {
    expect(slice(fx.marks.text, fx.marks.query)).toEqual([fx.marks.match]);
  });

  it('finds every occurrence of every term and merges overlaps', () => {
    expect(slice(fx.repeated.text, fx.repeated.query)).toEqual([
      fx.repeated.match,
      fx.repeated.match,
    ]);
    expect(slice(fx.overlap.text, fx.overlap.query)).toEqual([fx.overlap.match]);
  });

  it('returns no ranges for a blank or absent query', () => {
    expect(matchRanges(fx.absent.text, '')).toEqual([]);
    expect(matchRanges(fx.absent.text, fx.absent.query)).toEqual([]);
  });
});
