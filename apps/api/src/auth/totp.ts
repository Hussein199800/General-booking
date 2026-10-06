import { Secret, TOTP } from 'otpauth';

const PERIOD = 30;

export function newTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function totpUri(secretBase32: string, account: string): string {
  return new TOTP({
    issuer: 'SBA',
    label: account,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  }).toString();
}

/**
 * Validates a code within ±1 step and returns its time step, so the caller can
 * refuse any step not newer than the last accepted one (replay protection).
 */
export function acceptedStep(secretBase32: string, token: string, now = Date.now()): number | null {
  const totp = new TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
  const delta = totp.validate({ token, timestamp: now, window: 1 });
  if (delta === null) return null;
  return Math.floor(now / 1000 / PERIOD) + delta;
}
