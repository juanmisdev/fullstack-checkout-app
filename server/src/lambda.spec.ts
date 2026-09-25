// Lambda entrypoint smoke tests — the NestJS bootstrap is mocked so the test
// only verifies the real export surface and caching behavior of the handler.

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(async () => {
      const expressInstance = { disable: jest.fn() };
      return {
        use: jest.fn(),
        enableCors: jest.fn(),
        setGlobalPrefix: jest.fn(),
        init: jest.fn(),
        getHttpAdapter: () => ({ getInstance: () => expressInstance }),
      };
    }),
  },
}));

jest.mock('@vendia/serverless-express', () => {
  const serverlessExpress = jest.fn(() => jest.fn(async () => ({ statusCode: 200 })));
  return { __esModule: true, default: serverlessExpress };
});

jest.mock('helmet', () => () => 'helmet-middleware');
jest.mock('./app.module', () => ({ AppModule: class {} }));

import serverlessExpress from '@vendia/serverless-express';
import { NestFactory } from '@nestjs/core';
import { handler } from './lambda';

describe('lambda handler', () => {
  it('exports an async handler function', () => {
    expect(typeof handler).toBe('function');
  });

  it('bootstraps once and caches the handler across invocations', async () => {
    jest.clearAllMocks();
    const event = { httpMethod: 'GET', path: '/api/v1/products' };
    const res1 = await handler(event, {});
    const res2 = await handler(event, {});
    expect(NestFactory.create).toHaveBeenCalledTimes(1);
    expect(serverlessExpress).toHaveBeenCalledTimes(1);
    expect(await res1).toEqual({ statusCode: 200 });
    expect(res2).toEqual(res1);
  });
});