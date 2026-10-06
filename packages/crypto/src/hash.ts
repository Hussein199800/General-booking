import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';

export function sha256(data: Buffer | string): Buffer {
  return createHash('sha256').update(data).digest();
}

/**
 * Keyed hash for equality lookups on identifiers that must not be stored in
 * the clear (e.g. national ID numbers). The pepper lives outside the database.
 */
export class Pepper {
  readonly #secret: Buffer;

  constructor(secret: Buffer) {
    if (secret.length < 32) throw new Error('HMAC pepper must be at least 32 bytes');
    this.#secret = secret;
  }

  /** Reads a base64-encoded pepper from a secret file. */
  static fromFile(path: string): Pepper {
    return new Pepper(Buffer.from(readFileSync(path, 'utf8').trim(), 'base64'));
  }

  hmac(value: string): Buffer {
    return createHmac('sha256', this.#secret).update(value, 'utf8').digest();
  }

  matches(value: string, expected: Buffer): boolean {
    const actual = this.hmac(value);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
