import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error(`AES-256-GCM requires a ${String(KEY_BYTES)}-byte key`);
  }
}

/** Ciphertext and authentication tag kept apart, e.g. for a stored file whose tag lives in the DB. */
export interface DetachedCiphertext {
  readonly nonce: Buffer;
  readonly ciphertext: Buffer;
  readonly authTag: Buffer;
}

export function encryptDetached(key: Buffer, plaintext: Buffer, aad?: Buffer): DetachedCiphertext {
  assertKey(key);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
  if (aad) cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { nonce, ciphertext, authTag: cipher.getAuthTag() };
}

export function decryptDetached(key: Buffer, sealed: DetachedCiphertext, aad?: Buffer): Buffer {
  assertKey(key);
  if (sealed.nonce.length !== NONCE_BYTES || sealed.authTag.length !== TAG_BYTES) {
    throw new Error('Malformed AES-256-GCM nonce or tag');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, sealed.nonce, { authTagLength: TAG_BYTES });
  if (aad) decipher.setAAD(aad);
  decipher.setAuthTag(sealed.authTag);
  return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
}

/**
 * Self-contained sealed box: nonce(12) || ciphertext || tag(16). This is the
 * on-disk format of every encrypted bytea column (wrapped data keys, national
 * IDs, TOTP secrets, document metadata).
 */
export function seal(key: Buffer, plaintext: Buffer, aad?: Buffer): Buffer {
  const { nonce, ciphertext, authTag } = encryptDetached(key, plaintext, aad);
  return Buffer.concat([nonce, ciphertext, authTag]);
}

export function open(key: Buffer, box: Buffer, aad?: Buffer): Buffer {
  if (box.length < NONCE_BYTES + TAG_BYTES) {
    throw new Error('Sealed box is too short');
  }
  return decryptDetached(
    key,
    {
      nonce: box.subarray(0, NONCE_BYTES),
      ciphertext: box.subarray(NONCE_BYTES, box.length - TAG_BYTES),
      authTag: box.subarray(box.length - TAG_BYTES),
    },
    aad,
  );
}
