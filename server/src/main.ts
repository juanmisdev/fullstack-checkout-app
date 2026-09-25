// HTTP server bootstrap.

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Security headers (OWASP baseline) + hide the framework signature.
  app.use(helmet());
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // Explicit CORS allowlist instead of reflecting any origin.
  app.enableCors({
    origin: [
      'https://d30is68sphf1e9.cloudfront.net',
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    methods: 'GET,POST',
  });
  app.setGlobalPrefix('api/v1');
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`API listening on http://localhost:${port}`);
}
void bootstrap();