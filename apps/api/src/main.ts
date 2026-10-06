import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { APP_ENV } from './config/config.module.js';
import type { Env } from './config/env.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const env = app.get<Env>(APP_ENV);
  configureApp(app, env);
  await app.listen(env.API_PORT, env.API_HOST);
}

await bootstrap();
