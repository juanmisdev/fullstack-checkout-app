// AWS Lambda entrypoint — wraps the NestJS app with an Express-compatible handler.
// Cold start: builds the Nest app once and caches it across invocations.

import 'reflect-metadata';
import serverlessExpress from '@vendia/serverless-express';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

let cachedHandler: ReturnType<typeof serverlessExpress> | undefined;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  // Security headers (OWASP baseline) + hide the framework signature.
  app.use(helmet());
  app.enableCors({
    origin: [
      'https://d30is68sphf1e9.cloudfront.net',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    methods: 'GET,POST',
  });
  app.setGlobalPrefix('api/v1');
  await app.init();
  const expressInstance = app.getHttpAdapter().getInstance();
  if (expressInstance?.disable) {
    expressInstance.disable('x-powered-by');
  }
  return serverlessExpress({ app: expressInstance });
}

export const handler = async (event: unknown, context: unknown) => {
  if (!cachedHandler) {
    cachedHandler = await bootstrap();
  }
  return cachedHandler(event as never, context as never);
};