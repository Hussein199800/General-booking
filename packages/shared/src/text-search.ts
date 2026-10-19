/**
 * Arabic-aware matching for client-side search boxes.
 *
 * Folding ignores diacritics (tashkeel) and tatweel, unifies the hamza forms of
 * alef (أ إ آ ٱ → ا), alef maqsura with yaa (ى → ي), taa marbuta with haa
 * (ة → ه) and the hamza seats (ؤ → و, ئ → ي), and lower-cases Latin letters.
 * Matches are reported as ranges of the ORIGINAL text so they can be highlighted.
 */

/** Combining marks and tatweel, dropped when folding. */
const IGNORED = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/;

/** Letter variants folded onto one base letter (by code point). */
const FOLDS: ReadonlyMap<number, number> = new Map([
  [0x0623, 0x0627], // alef with hamza above → alef
  [0x0625, 0x0627], // alef with hamza below → alef
  [0x0622, 0x0627], // alef with madda → alef
  [0x0671, 0x0627], // alef wasla → alef
  [0x0649, 0x064a], // alef maqsura → yaa
  [0x0629, 0x0647], // taa marbuta → haa
  [0x0624, 0x0648], // waw with hamza → waw
  [0x0626, 0x064a], // yaa with hamza → yaa
]);

interface Folded {
  readonly text: string;
  /** For each folded character, the index of the original character it came from. */
  readonly origin: readonly number[];
}

function foldWithOrigin(input: string): Folded {
  let text = '';
  const origin: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const char = input.charAt(index);
    if (IGNORED.test(char)) continue;
    const folded = FOLDS.get(char.charCodeAt(0));
    text += folded === undefined ? char.toLowerCase() : String.fromCharCode(folded);
    origin.push(index);
  }
  return { text, origin };
}

/** The folded form of `input`, for comparisons. */
export function foldArabic(input: string): string {
  return foldWithOrigin(input).text;
}

/** The distinct search terms of a query, folded; empty for a blank query. */
export function searchTerms(query: string): string[] {
  return [...new Set(foldArabic(query).split(/\s+/).filter(Boolean))];
}

/** True when every term of `query` occurs somewhere in `haystack` (a blank query matches). */
export function matchesQuery(haystack: string, query: string): boolean {
  const text = foldArabic(haystack);
  return searchTerms(query).every((term) => text.includes(term));
}

export interface MatchRange {
  readonly start: number;
  /** Exclusive. */
  readonly end: number;
}

/**
 * Ranges of `text` matching any term of `query`, sorted and merged. A range
 * also covers the diacritics that follow its last letter, so a highlight never
 * splits a letter from its marks.
 */
export function matchRanges(text: string, query: string): MatchRange[] {
  const folded = foldWithOrigin(text);
  const ranges: MatchRange[] = [];
  for (const term of searchTerms(query)) {
    let from = folded.text.indexOf(term);
    while (from !== -1) {
      const start = folded.origin[from] ?? 0;
      let end = (folded.origin[from + term.length - 1] ?? start) + 1;
      while (end < text.length && IGNORED.test(text.charAt(end))) end += 1;
      ranges.push({ start, end });
      from = folded.text.indexOf(term, from + 1);
    }
  }
  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MatchRange[] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, range.end) };
    } else {
      merged.push(range);
    }
  }
  return merged;
}
