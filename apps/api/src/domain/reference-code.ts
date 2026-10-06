import { randomInt } from 'node:crypto';

// Crockford base32 without easily confused characters.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** e.g. REQ-2026-4K7Q9T — random, so references cannot be enumerated. */
export function newReferenceCode(prefix: 'REQ' | 'GRV', now = new Date()): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += ALPHABET.charAt(randomInt(ALPHABET.length));
  return `${prefix}-${String(now.getUTCFullYear())}-${suffix}`;
}
