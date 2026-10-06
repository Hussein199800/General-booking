import { Global, Module } from '@nestjs/common';

import { loadEnv, type Env } from './env.js';
import { loadSecrets, type Secrets } from './secrets.js';

export const APP_ENV = Symbol('APP_ENV');
export const SECRETS = Symbol('SECRETS');

@Global()
@Module({
  providers: [
    { provide: APP_ENV, useFactory: (): Env => loadEnv() },
    { provide: SECRETS, useFactory: (env: Env): Secrets => loadSecrets(env), inject: [APP_ENV] },
  ],
  exports: [APP_ENV, SECRETS],
})
export class ConfigModule {}
