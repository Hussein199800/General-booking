import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { ErrorFilter } from './common/error.filter.js';
import { requestContextMiddleware } from './common/request-context.js';
import type { Env } from './config/env.js';

/** Everything that must be identical in production and in end-to-end tests. */
export function configureApp(app: NestExpressApplication, env: Env): void {
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
  // Only the configured number of reverse proxies are trusted for the client IP,
  // which feeds rate limiting and the audit log.
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.useBodyParser('json', { limit: '64kb' });
  app.use(cookieParser());
  app.use(requestContextMiddleware);

  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-CSRF-Token'],
    maxAge: 600,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
}
