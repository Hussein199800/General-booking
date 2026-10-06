import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * Route-specific limits for @Throttle. Decorators are evaluated at import time,
 * so these read the (already validated) environment lazily, per request.
 */
const numberFromEnv = (name: string, fallback: number) => () => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};

export const AUTH_THROTTLE: Record<string, ThrottlerOptions> = {
  default: { ttl: 60_000, limit: numberFromEnv('AUTH_RATE_LIMIT_PER_MINUTE', 10) },
};

export const PUBLIC_SUBMIT_THROTTLE: Record<string, ThrottlerOptions> = {
  default: { ttl: 3_600_000, limit: numberFromEnv('PUBLIC_SUBMIT_RATE_LIMIT_PER_HOUR', 5) },
};
