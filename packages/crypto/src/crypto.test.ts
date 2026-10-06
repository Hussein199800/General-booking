import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { NONCE_BYTES, TAG_BYTES, open, seal } from './aes-gcm.js';
import { Pepper, sha256 } from './hash.js';
import { KeyRing } from './key-ring.js';

const key = () => randomBytes(32);

describe('seal / open', () => {
  it('round-trips and uses the documented layout', () => {
    const k = key();
    const box = seal(k, Buffer.from('secret'));
    expect(box.length).toBe(NONCE_BYTES + 'secret'.length + TAG_BYTES);
    expect(open(k, box).toString()).toBe('secret');
  });

  it('wraps a 32-byte data key into exactly 60 bytes (documents.wrapped_dek)', () => {
    expect(seal(key(), randomBytes(32))).toHaveLength(60);
  });

  it('never reuses a nonce', () => {
    const k = key();
    const a = seal(k, Buffer.from('x'));
    const b = seal(k, Buffer.from('x'));
    expect(a.subarray(0, NONCE_BYTES).equals(b.subarray(0, NONCE_BYTES))).toBe(false);
  });

  it('rejects tampered ciphertext, a wrong key and mismatched AAD', () => {
    const k = key();
    const box = seal(k, Buffer.from('secret'), Buffer.from('doc-1'));
    const tampered = Buffer.from(box);
    tampered[NONCE_BYTES] = (tampered[NONCE_BYTES] ?? 0) ^ 0xff;
    expect(() => open(k, tampered, Buffer.from('doc-1'))).toThrow();
    expect(() => open(key(), box, Buffer.from('doc-1'))).toThrow();
    expect(() => open(k, box, Buffer.from('doc-2'))).toThrow();
  });

  it('rejects keys that are not 256-bit', () => {
    expect(() => seal(randomBytes(16), Buffer.from('x'))).toThrow(/32-byte/);
  });
});

describe('KeyRing', () => {
  const json = (ids: string[]) =>
    JSON.stringify(Object.fromEntries(ids.map((id) => [id, key().toString('base64')])));

  it('seals with the active key and opens with the recorded key id after rotation', () => {
    const file = json(['kek-2026-01', 'kek-2026-02']);
    const before = KeyRing.fromJson(file, 'kek-2026-01');
    const { keyId, box } = before.seal(Buffer.from('national-id'));
    expect(keyId).toBe('kek-2026-01');

    const after = KeyRing.fromJson(file, 'kek-2026-02');
    expect(after.seal(Buffer.from('x')).keyId).toBe('kek-2026-02');
    expect(after.open(keyId, box).toString()).toBe('national-id');
  });

  it('refuses an active key id that is not present', () => {
    expect(() => KeyRing.fromJson(json(['kek-a1']), 'kek-b1')).toThrow(/not in the key ring/);
  });

  it('refuses short keys and malformed files', () => {
    expect(() =>
      KeyRing.fromJson(JSON.stringify({ 'kek-a1': randomBytes(16).toString('base64') }), 'kek-a1'),
    ).toThrow(/32 bytes/);
    expect(() => KeyRing.fromJson('[]', 'kek-a1')).toThrow(/JSON object/);
  });
});

describe('Pepper', () => {
  it('produces stable 32-byte HMACs and verifies in constant time', () => {
    const pepper = new Pepper(randomBytes(32));
    const digest = pepper.hmac('01234567890');
    expect(digest).toHaveLength(32);
    expect(pepper.matches('01234567890', digest)).toBe(true);
    expect(pepper.matches('01234567891', digest)).toBe(false);
  });

  it('differs between peppers and from a plain hash', () => {
    const value = '01234567890';
    expect(
      new Pepper(randomBytes(32)).hmac(value).equals(new Pepper(randomBytes(32)).hmac(value)),
    ).toBe(false);
    expect(new Pepper(randomBytes(32)).hmac(value).equals(sha256(value))).toBe(false);
  });

  it('refuses weak peppers', () => {
    expect(() => new Pepper(randomBytes(8))).toThrow(/at least 32 bytes/);
  });
});
