import { createHash, randomBytes } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'sba-api';
const AUDIENCE = 'sba-web';

export interface AccessClaims {
  readonly userId: string;
  readonly sessionId: string;
}

export async function signAccessToken(
  key: Uint8Array,
  claims: AccessClaims,
  ttlSeconds: number,
): Promise<string> {
  return new SignJWT({ sid: claims.sessionId, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${String(ttlSeconds)}s`)
    .sign(key);
}

/** Returns the claims of a valid access token, or null. */
export async function verifyAccessToken(
  key: Uint8Array,
  token: string,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (
      payload.typ !== 'access' ||
      typeof payload.sub !== 'string' ||
      typeof payload.sid !== 'string'
    )
      return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

/** 256-bit opaque token for refresh / CSRF / single-use links. */
export function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this digest is stored; the token itself never touches the database. */
export function tokenHash(token: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(createHash('sha256').update(token, 'utf8').digest());
}
