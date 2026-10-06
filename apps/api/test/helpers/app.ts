import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { createPrismaClient, type PrismaClient } from '@sba/db';
import { inject } from 'vitest';

import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { APP_ENV } from '../../src/config/config.module.js';
import type { Env } from '../../src/config/env.js';

export interface TestApp {
  readonly app: NestExpressApplication;
  /** Owner connection for arranging fixtures and inspecting results. */
  readonly owner: PrismaClient;
  close(): Promise<void>;
}

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  const env = { ...inject('e2eEnv'), ...overrides };
  Object.assign(process.env, env);
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: ['error'],
  });
  configureApp(app, app.get<Env>(APP_ENV));
  await app.init();
  const owner = createPrismaClient(env.DATABASE_MIGRATION_URL ?? '');
  return {
    app,
    owner,
    async close() {
      await owner.$disconnect();
      await app.close();
    },
  };
}
