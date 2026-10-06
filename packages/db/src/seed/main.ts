import { KeyRing, Pepper } from '@sba/crypto';

import { createPrismaClient } from '../client.js';
import { loadSeedEnv } from './config.js';
import { seed } from './seed.js';

const env = loadSeedEnv();
const db = createPrismaClient(env.DATABASE_MIGRATION_URL);

try {
  const demo =
    env.SEED_DEMO_DATA &&
    env.SEED_DEMO_PASSWORD &&
    env.MASTER_KEYS_FILE &&
    env.MASTER_KEY_ACTIVE_ID &&
    env.PII_HMAC_PEPPER_FILE
      ? {
          password: env.SEED_DEMO_PASSWORD,
          keyRing: KeyRing.fromFile(env.MASTER_KEYS_FILE, env.MASTER_KEY_ACTIVE_ID),
          pepper: Pepper.fromFile(env.PII_HMAC_PEPPER_FILE),
        }
      : null;
  const summary = await db.$transaction((tx) => seed(tx, demo), {
    timeout: 120_000,
    maxWait: 10_000,
  });
  console.log(`Seed complete: ${JSON.stringify(summary)}`);
} finally {
  await db.$disconnect();
}
