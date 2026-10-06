import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AdminModule } from './admin/admin.controller.js';
import { AgendaModule } from './agenda/agenda.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { APP_ENV, ConfigModule } from './config/config.module.js';
import type { Env } from './config/env.js';
import { HealthController } from './health/health.controller.js';
import { IdempotencyInterceptor } from './idempotency/idempotency.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OversightModule } from './oversight/oversight.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ReferenceModule } from './reference/reference.module.js';
import { TicketsModule } from './tickets/tickets.module.js';
import { UnitsModule } from './units/units.controller.js';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuditModule,
    AuthModule,
    NotificationsModule,
    TicketsModule,
    AgendaModule,
    ReferenceModule,
    UnitsModule,
    AdminModule,
    OversightModule,
    // Per-IP request budget; stricter limits are set on sign-in and public intake.
    ThrottlerModule.forRootAsync({
      inject: [APP_ENV],
      useFactory: (env: Env) => [
        { name: 'default', ttl: 60_000, limit: env.RATE_LIMIT_PER_MINUTE },
      ],
    }),
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: throttle first (cheap), then authenticate and authorise.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
