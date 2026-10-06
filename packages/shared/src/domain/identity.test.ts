import { describe, expect, it } from 'vitest';

import { normalizeNationalId } from './identity.js';

describe('normalizeNationalId', () => {
  it('accepts 11 digits with separators', () => {
    expect(normalizeNationalId(' 010-1234-5678 ')).toBe('01012345678');
  });

  it('converts Eastern Arabic digits', () => {
    const eastern = '01012345678'.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
    expect(eastern).not.toBe('01012345678');
    expect(normalizeNationalId(eastern)).toBe('01012345678');
  });

  it('rejects anything that is not 11 digits', () => {
    expect(normalizeNationalId('1234')).toBeNull();
    expect(normalizeNationalId('012345678901')).toBeNull();
    expect(normalizeNationalId('')).toBeNull();
  });
});
