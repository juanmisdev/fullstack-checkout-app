// Unit tests — CheckoutController error mapping (mapErrorToException branches).

import { CheckoutController } from './controllers';
import { CheckoutService } from '../../application/services/checkout.service';
import { Ok, Err } from '../../domain/shared/result';
import {
  InsufficientStockError,
  ProductNotFoundError,
  PaymentDeclinedError,
  InvalidCardError,
} from '../../domain/shared/errors';
import { GatewayError } from '../../application/ports/ports';
import { ConflictException, NotFoundException, HttpException, InternalServerErrorException } from '@nestjs/common';
import type { CheckoutInput, CheckoutOutput } from '../../application/use-cases/checkout.use-case';

const output: CheckoutOutput = {
  transactionId: 'tx_1',
  status: 'APPROVED',
  totalInCents: 260500,
  receipt: { productRef: 'prod_001', customerRef: 'cus_1', deliveryRef: 'tx_1' },
};

const input = (): CheckoutInput => ({
  productId: 'prod_001',
  units: 1,
  card: { number: '4242424242424242', cvv: '123', expiryMonth: 12, expiryYear: 2099, holderName: 'JOHN DOE' },
  customer: { fullName: 'John Doe', email: 'john@example.com', phone: '+573001234567' },
  delivery: { address: 'Calle 1', city: 'Bogota', postalCode: '110111' },
  baseFeeInCents: 0,
  deliveryFeeInCents: 10000,
});

const makeController = (result: ReturnType<typeof Ok> | ReturnType<typeof Err>) => {
  const service = {
    checkout: jest.fn().mockResolvedValue(result),
  } as unknown as CheckoutService;
  return { controller: new CheckoutController(service), service };
};

describe('CheckoutController error mapping', () => {
  it('returns the checkout output on success', async () => {
    const { controller } = makeController(Ok(output));
    const res = await controller.checkout(input());
    expect(res).toEqual({ data: output });
  });

  it('maps INSUFFICIENT_STOCK to 409 Conflict', async () => {
    const { controller } = makeController(Err(new InsufficientStockError()));
    await expect(controller.checkout(input())).rejects.toThrow(ConflictException);
    await expect(controller.checkout(input())).rejects.toMatchObject({ status: 409 });
  });

  it('maps PRODUCT_NOT_FOUND to 404 Not Found', async () => {
    const { controller } = makeController(Err(new ProductNotFoundError('prod_x')));
    await expect(controller.checkout(input())).rejects.toThrow(NotFoundException);
  });

  it('maps PAYMENT_DECLINED to 402', async () => {
    const { controller } = makeController(Err(new PaymentDeclinedError('declined')));
    await expect(controller.checkout(input())).rejects.toMatchObject({ status: 402 });
    await expect(controller.checkout(input())).rejects.toMatchObject({
      response: { error: 'PAYMENT_DECLINED' },
    });
  });

  it('maps INVALID_CARD to 422', async () => {
    const { controller } = makeController(Err(new InvalidCardError('bad cvv')));
    await expect(controller.checkout(input())).rejects.toMatchObject({ status: 422 });
    await expect(controller.checkout(input())).rejects.toMatchObject({
      response: { error: 'INVALID_CARD' },
    });
  });

  it('maps unknown errors to 500 Internal Server Error', async () => {
    const { controller } = makeController(Err(new GatewayError('boom')));
    await expect(controller.checkout(input())).rejects.toThrow(InternalServerErrorException);
  });

  it('maps an error without a code to 500', async () => {
    const { controller } = makeController(Err(new Error('mystery')));
    await expect(controller.checkout(input())).rejects.toThrow(HttpException);
  });

  it('passes the idempotency key through to the service when provided', async () => {
    const { controller, service } = makeController(Ok(output));
    await controller.checkout({ ...input(), idempotencyKey: 'idem-1' });
    expect(service.checkout).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKey: 'idem-1' }),
    );
  });
});