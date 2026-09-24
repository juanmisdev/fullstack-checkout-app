// HTTP integration tests — real Nest application exercised through supertest.

import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { CheckoutService } from './application/services/checkout.service';

const VALID_CARD = { number: '4242424242424242', cvv: '123', expiryMonth: 12, expiryYear: 2099, holderName: 'JOHN DOE' };

const checkoutPayload = () => ({
  productId: 'prod_001',
  units: 1,
  card: VALID_CARD,
  customer: { fullName: 'John Doe', email: 'john@example.com', phone: '+573001234567' },
  delivery: { address: 'Calle 1 #2-3', city: 'Bogota', postalCode: '110111' },
  deliveryFeeInCents: 10000,
});

async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

describe('App (e2e)', () => {
  describe('products & transactions', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/v1/products lists the seeded products', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/products').expect(200);
      // 3 seeded products: headphones (prod_001), keyboard (prod_002), shoes (prod_003).
      expect(res.body.data).toHaveLength(3);
      expect(res.body.data[0].props).toMatchObject({ id: 'prod_001', name: 'Wireless Headphones', stock: 12 });
    });

    it('GET /api/v1/products/prod_001 returns the product', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/products/prod_001').expect(200);
      expect(res.body.data.props).toMatchObject({ id: 'prod_001', name: 'Wireless Headphones', stock: 12 });
    });

    it('GET /api/v1/products/nope returns 404', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/products/nope').expect(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('GET /api/v1/transactions/nope returns 404', async () => {
      await request(app.getHttpServer()).get('/api/v1/transactions/nope').expect(404);
    });

    it('service-level: newId() is unique and getTransaction(unknown) is null', () => {
      const service = app.get(CheckoutService);
      expect(service.newId()).not.toBe(service.newId());
      return service.getTransaction('nope').then((tx) => expect(tx).toBeNull());
    });
  });

  describe('checkout with unreachable gateway', () => {
    let app: INestApplication;
    let savedApiUrl: string | undefined;
    let savedPublicKey: string | undefined;

    beforeAll(async () => {
      savedApiUrl = process.env.GATEWAY_API_URL;
      savedPublicKey = process.env.GATEWAY_PUBLIC_KEY;
      // Port 1 is unreachable: fetch fails fast with ECONNREFUSED (no real network).
      process.env.GATEWAY_API_URL = 'http://localhost:1';
      delete process.env.GATEWAY_PUBLIC_KEY;
      app = await createApp(); // adapter reads env at construction time
    });

    afterAll(async () => {
      await app.close();
      if (savedApiUrl === undefined) delete process.env.GATEWAY_API_URL;
      else process.env.GATEWAY_API_URL = savedApiUrl;
      if (savedPublicKey === undefined) delete process.env.GATEWAY_PUBLIC_KEY;
      else process.env.GATEWAY_PUBLIC_KEY = savedPublicKey;
    });

    it('POST /api/v1/checkout fails gracefully when the gateway is unreachable', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/checkout')
        .send(checkoutPayload())
        .expect(500); // controller throws InternalServerErrorException for gateway failures

      expect(res.body.statusCode).toBe(500);
      expect(res.body.message).toContain('Unexpected gateway failure');
      expect(res.body.data).toBeUndefined();
    });
  });
});