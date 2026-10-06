import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client.js';

/**
 * The API passes DATABASE_URL (least-privilege `sba_app`); the seed and other
 * deployment tasks pass DATABASE_MIGRATION_URL (schema owner).
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
