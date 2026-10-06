import { readFileSync } from 'node:fs';

import { KEY_BYTES, open, seal } from './aes-gcm.js';

const KEY_ID = /^[a-z0-9][a-z0-9-]{1,62}$/;

/**
 * Master keys (key-encryption keys), addressed by id so that data sealed under
 * an older key stays readable after rotation. Keys are loaded from a secret
 * file and never leave process memory.
 */
export class KeyRing {
  readonly #keys: ReadonlyMap<string, Buffer>;
  readonly activeKeyId: string;

  constructor(keys: ReadonlyMap<string, Buffer>, activeKeyId: string) {
    if (!keys.has(activeKeyId)) {
      throw new Error(`Active master key "${activeKeyId}" is not in the key ring`);
    }
    for (const [id, key] of keys) {
      if (!KEY_ID.test(id)) throw new Error(`Invalid master key id "${id}"`);
      if (key.length !== KEY_BYTES) {
        throw new Error(`Master key "${id}" must be ${String(KEY_BYTES)} bytes`);
      }
    }
    this.#keys = keys;
    this.activeKeyId = activeKeyId;
  }

  /** Parses `{ "<keyId>": "<base64 32 bytes>", ... }`. */
  static fromJson(json: string, activeKeyId: string): KeyRing {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Master key file must be a JSON object of { keyId: base64Key }');
    }
    const keys = new Map<string, Buffer>();
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') throw new Error(`Master key "${id}" must be a base64 string`);
      keys.set(id, Buffer.from(value, 'base64'));
    }
    return new KeyRing(keys, activeKeyId);
  }

  static fromFile(path: string, activeKeyId: string): KeyRing {
    return KeyRing.fromJson(readFileSync(path, 'utf8'), activeKeyId);
  }

  /** Seals with the active key; store the returned keyId next to the box. */
  seal(plaintext: Buffer, aad?: Buffer): { keyId: string; box: Buffer } {
    return { keyId: this.activeKeyId, box: seal(this.#key(this.activeKeyId), plaintext, aad) };
  }

  open(keyId: string, box: Buffer, aad?: Buffer): Buffer {
    return open(this.#key(keyId), box, aad);
  }

  #key(id: string): Buffer {
    const key = this.#keys.get(id);
    if (!key) throw new Error(`Unknown master key id "${id}"`);
    return key;
  }
}
