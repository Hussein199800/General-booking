import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module.js';
import { APP_ENV } from './config/config.module.js';
import type { Env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const env = app.get<Env>(APP_ENV);

  // The API serves JSON only, so the CSP denies everything a browser could load.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'none'"] },
      },
      frameguard: { action: 'deny' },
      strictTransportSecurity: { maxAge: 63_072_000, includeSubDomains: true, preload: true },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.disable('x-powered-by');
  // One reverse proxy (on-premise TLS terminator) sits in front of the API; trust only it
  // so rate limiting and audit logs record the real client IP.
  app.set('trust proxy', 1);

  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-CSRF-Token'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  await app.listen(env.API_PORT, env.API_HOST);
}

await bootstrap();
