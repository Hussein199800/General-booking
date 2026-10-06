import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { createPrismaClient, type PrismaClient } from '@sba/db';

import { APP_ENV } from '../config/config.module.js';
import type { Env } from '../config/env.js';

/** Connects as the least-privilege runtime role (DATABASE_URL). */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(APP_ENV) env: Env) {
    this.client = createPrismaClient(env.DATABASE_URL);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
