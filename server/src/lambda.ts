// AWS Lambda entrypoint — wraps the NestJS app with an Express-compatible handler.
// Cold start: builds the Nest app once and caches it across invocations.

import 'reflect-metadata';
import serverlessExpress from '@vendia/serverless-express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

let cachedHandler: ReturnType<typeof serverlessExpress> | undefined;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true, logger: false });
  app.setGlobalPrefix('api/v1');
  await app.init();
  const expressInstance = app.getHttpAdapter().getInstance();
  return serverlessExpress({ app: expressInstance });
}

export const handler = async (event: unknown, context: unknown) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  return cachedHandler(event as never, context as never);
};