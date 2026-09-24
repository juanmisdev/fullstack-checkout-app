export class DomainError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

export class InsufficientStockError extends DomainError {
  constructor() {
    super('Insufficient stock for the requested units', 'INSUFFICIENT_STOCK');
  }
}

export class ProductNotFoundError extends DomainError {
  constructor(id: string) {
    super(`Product ${id} not found`, 'PRODUCT_NOT_FOUND');
  }
}

export class PaymentDeclinedError extends DomainError {
  constructor(reason: string) {
    super(`Payment declined: ${reason}`, 'PAYMENT_DECLINED');
  }
}

export class InvalidCardError extends DomainError {
  constructor(reason: string) {
    super(`Invalid card data: ${reason}`, 'INVALID_CARD');
  }
}