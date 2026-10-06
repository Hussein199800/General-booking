import { readFileSync } from 'node:fs';

import { KeyRing, Pepper } from '@sba/crypto';

import type { Env } from './env.js';

/** Key material held in memory only; never logged, never persisted. */
export interface Secrets {
  readonly keyRing: KeyRing;
  readonly pepper: Pepper;
  /** HS256 key for access tokens. */
  readonly jwtKey: Uint8Array;
}

export function loadSecrets(env: Env): Secrets {
  const jwtKey = Buffer.from(readFileSync(env.JWT_SIGNING_KEY_FILE, 'utf8').trim(), 'base64');
  if (jwtKey.length < 32) throw new Error('JWT signing key must be at least 32 bytes');
  return {
    keyRing: KeyRing.fromFile(env.MASTER_KEYS_FILE, env.MASTER_KEY_ACTIVE_ID),
    pepper: Pepper.fromFile(env.PII_HMAC_PEPPER_FILE),
    jwtKey: new Uint8Array(jwtKey),
  };
}
