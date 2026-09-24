// Thin controllers — ONLY HTTP protocol concerns. Zero business logic here.

import { Body, Controller, Get, Injectable, NotFoundException, Param, Post } from '@nestjs/common';
import { IsEmail, IsInt, IsNotEmpty, IsPositive, Min } from 'class-validator';
import { CheckoutService } from '../../application/services/checkout.service';
import { CheckoutError } from '../../application/use-cases/checkout.use-case';

// --- DTOs (request validation) ---

export class CardDto {
  @IsNotEmpty() number!: string;
  @IsNotEmpty() cvv!: string;
  @IsInt() @IsPositive() expiryMonth!: number;
  @IsInt() @IsPositive() expiryYear!: number;
  @IsNotEmpty() holderName!: string;
}

export class CustomerDto {
  @IsNotEmpty() fullName!: string;
  @IsEmail() email!: string;
  @IsNotEmpty() phone!: string;
}

export class DeliveryDto {
  @IsNotEmpty() address!: string;
  @IsNotEmpty() city!: string;
  @IsNotEmpty() postalCode!: string;
}

export class CheckoutRequestDto {
  @IsNotEmpty() productId!: string;
  @IsInt() @IsPositive() units!: number;
  card!: CardDto;
  customer!: CustomerDto;
  delivery!: DeliveryDto;
  deliveryFeeInCents!: number;
}

// --- Controllers ---

@Controller('products')
@Injectable()
export class ProductsController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get()
  async list() {
    return { data: await this.checkoutService.listProducts() };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const product = await this.checkoutService.getProduct(id);
    if (!product) throw new NotFoundException('Product not found');
    return { data: product };
  }
}

@Controller('transactions')
@Injectable()
export class TransactionsController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get(':id')
  async get(@Param('id') id: string) {
    const tx = await this.checkoutService.getTransaction(id);
    if (!tx) throw new NotFoundException('Transaction not found');
    return { data: tx };
  }
}

@Controller('checkout')
@Injectable()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  async checkout(@Body() dto: CheckoutRequestDto) {
    const result = await this.checkoutService.checkout({
      productId: dto.productId,
      units: dto.units,
      card: dto.card,
      customer: dto.customer,
      delivery: dto.delivery,
      deliveryFeeInCents: dto.deliveryFeeInCents,
      baseFeeInCents: 0, // service applies the configured base fee
    });

    if (!result.ok) {
      const err = result.error as CheckoutHttpError;
      const status = mapErrorToHttpStatus(err);
      return {
        statusCode: status.code,
        error: err.code ?? 'CHECKOUT_ERROR',
        message: err.message,
      };
    }
    return { data: result.value };
  }
}

interface CheckoutHttpError extends Error {
  code?: string;
}

const mapErrorToHttpStatus = (err: CheckoutHttpError): { code: number } => {
  switch (err.code) {
    case 'INSUFFICIENT_STOCK':
      return { code: 409 };
    case 'PRODUCT_NOT_FOUND':
      return { code: 404 };
    case 'PAYMENT_DECLINED':
      return { code: 402 };
    case 'INVALID_CARD':
      return { code: 422 };
    default:
      return { code: 500 };
  }
};