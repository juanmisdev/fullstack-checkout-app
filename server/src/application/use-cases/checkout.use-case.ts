// Use Case: complete checkout — ROP pipeline with Result types.
// Flow: validate card -> ensure stock -> persist customer -> create PENDING transaction
//       -> charge via gateway port -> update transaction -> create delivery -> decrease stock.

import { ProductRepositoryPort, TransactionRepositoryPort, CustomerRepositoryPort, DeliveryRepositoryPort, PaymentGatewayPort, GatewayError } from '../ports/ports';
import { Ok, Err, Result, attemptAsync, flatMap } from '../../domain/shared/result';
import { InsufficientStockError, PaymentDeclinedError, ProductNotFoundError } from '../../domain/shared/errors';
import { validateCard } from '../../domain/payments/card-validator';
import { Transaction } from '../../domain/transactions/transaction.entity';
import { Customer } from '../../domain/customers/customer.entity';
import { Delivery } from '../../domain/customers/customer.entity';

export interface CheckoutInput {
  productId: string;
  units: number;
  card: {
    number: string;
    cvv: string;
    expiryMonth: number;
    expiryYear: number;
    holderName: string;
  };
  customer: { fullName: string; email: string; phone: string };
  delivery: { address: string; city: string; postalCode: string };
  /** Base fee added always, configured at API level (cents). */
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  /** Optional: when provided and already known, the existing transaction outcome is returned (idempotent retries). */
  idempotencyKey?: string;
}

export interface CheckoutOutput {
  transactionId: string;
  status: 'APPROVED' | 'DECLINED';
  totalInCents: number;
  receipt: {
    productRef: string;
    customerRef: string;
    deliveryRef: string;
  };
}

export type CheckoutError =
  | InsufficientStockError
  | ProductNotFoundError
  | PaymentDeclinedError
  | GatewayError
  | Error;

export class CheckoutUseCase {
  constructor(
    private readonly productRepo: ProductRepositoryPort,
    private readonly transactionRepo: TransactionRepositoryPort,
    private readonly customerRepo: CustomerRepositoryPort,
    private readonly deliveryRepo: DeliveryRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort,
    private readonly idGenerator: { generate(): string },
  ) {}

  async execute(input: CheckoutInput): Promise<Result<CheckoutOutput, CheckoutError>> {
    // 0. Idempotency: reuse an existing transaction for the same key instead of
    // charging again (safe retries / double submits of the same attempt).
    if (input.idempotencyKey) {
      const existing = await attemptAsync(() => this.transactionRepo.findById(input.idempotencyKey!));
      if (!existing.ok) return Err(existing.error);
      if (existing.value) return Ok(this.outputFromTransaction(existing.value));
    }

    // 1. Validate card structure (pure domain, fail fast)
    const cardCheck = await attemptAsync(async () => {
      validateCard(input.card);
      return input.card;
    });
    if (!cardCheck.ok) return Err(cardCheck.error);

    // 2. Load product and check stock
    const productResult = await attemptAsync(() => this.productRepo.findById(input.productId));
    if (!productResult.ok) return Err(productResult.error);
    if (!productResult.value) return Err(new ProductNotFoundError(input.productId));

    const product = productResult.value;
    if (!product.hasStock(input.units)) return Err(new InsufficientStockError());

    // 3. Persist customer
    const customerId = this.idGenerator.generate();
    const customer = Customer.create({ id: customerId, ...input.customer });
    const customerSave = await attemptAsync(() => this.customerRepo.save(customer));
    if (!customerSave.ok) return Err(customerSave.error);

    // 4. Create PENDING transaction. With an idempotency key the transaction id
    // IS the key, so retries of the same attempt map onto this same row.
    const transactionId = input.idempotencyKey ?? this.idGenerator.generate();
    const transaction = Transaction.createPending({
      id: transactionId,
      productRef: product.id,
      customerRef: customer.id,
      amountInCents: product.priceInCents * input.units,
      baseFeeInCents: input.baseFeeInCents,
      deliveryFeeInCents: input.deliveryFeeInCents,
    });
    const txSave = await attemptAsync(() => this.transactionRepo.save(transaction));
    if (!txSave.ok) return Err(txSave.error);

    // 5. Charge via gateway (driven port)
    const chargeResult = await this.chargeGateway(transaction, input.customer.email, input.card);
    if (!chargeResult.ok) return Err(chargeResult.error);

    // 6. Update transaction with result
    const finalTxResult = flatMap(chargeResult, (charge) =>
      charge.status === 'APPROVED'
        ? Ok(transaction.approve(charge.gatewayTransactionId))
        : Err(new PaymentDeclinedError('Gateway declined the transaction')),
    );
    if (!finalTxResult.ok) {
      await this.transactionRepo.save(transaction.decline(chargeResult.ok ? chargeResult.value.gatewayTransactionId : undefined));
      return Err(finalTxResult.error);
    }
    const finalTx = finalTxResult.value;
    const finalSave = await attemptAsync(() => this.transactionRepo.save(finalTx));
    if (!finalSave.ok) return Err(finalSave.error);

    // 7. Only on APPROVED: create delivery + decrease stock
    if (finalTx.status === 'APPROVED') {
      const deliveryId = this.idGenerator.generate();
      const delivery = Delivery.create({
        id: deliveryId,
        transactionRef: transaction.id,
        customerRef: customer.id,
        productRef: product.id,
        ...input.delivery,
      });
      const deliverySave = await attemptAsync(() => this.deliveryRepo.save(delivery));
      if (!deliverySave.ok) return Err(deliverySave.error);

      const stockResult = await attemptAsync(() => this.productRepo.decreaseStock(product.id, input.units));
      if (!stockResult.ok) return Err(stockResult.error);
    }

    return Ok({
      transactionId: transaction.id,
      status: finalTx.status as 'APPROVED' | 'DECLINED',
      totalInCents: finalTx.totalInCents(),
      receipt: {
        productRef: product.id,
        customerRef: customer.id,
        deliveryRef: transaction.id,
      },
    });
  }

  /** Maps a stored transaction back to the checkout output shape (idempotent replays). */
  private outputFromTransaction(tx: Transaction): CheckoutOutput {
    return {
      transactionId: tx.id,
      status: tx.status === 'APPROVED' ? 'APPROVED' : 'DECLINED',
      totalInCents: tx.totalInCents(),
      receipt: {
        productRef: tx.props.productRef,
        customerRef: tx.props.customerRef,
        deliveryRef: tx.id,
      },
    };
  }

  private async chargeGateway(
    transaction: Transaction,
    email: string,
    card: { number: string; cvv: string; expiryMonth: number; expiryYear: number; holderName: string },
  ): Promise<Result<PaymentGatewayChargeResultOf, GatewayError | PaymentDeclinedError>> {
    try {
      const result = await this.paymentGateway.charge({
        amountInCents: transaction.totalInCents(),
        customerEmail: email,
        cardToken: cardTokenFrom(card),
        reference: transaction.id,
        rawCard: card,
      });
      return Ok(result);
    } catch (e) {
      if (e instanceof GatewayError) return Err(e);
      return Err(new GatewayError('Unexpected gateway failure', e));
    }
  }
}

type PaymentGatewayChargeResultOf = {
  ok: true;
  gatewayTransactionId: string;
  status: 'APPROVED' | 'DECLINED';
};

// NOTE: in a real integration the card tokenization happens on the gateway
// side (JS SDK / tokenize endpoint). For the sandbox test flow we simulate
// tokenization from the raw test card — never store the raw number.
const cardTokenFrom = (card: { number: string }): string =>
  `tok_test_${card.number.replace(/[\s-]/g, '').slice(-4)}`;