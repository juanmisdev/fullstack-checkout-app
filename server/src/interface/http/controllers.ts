// Thin controllers — ONLY HTTP protocol concerns. Zero business logic here.

import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Body, ConflictException, Controller, Get, HttpException, Injectable, InternalServerErrorException, NotFoundException, Param, Post } from '@nestjs/common';
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
  @IsInt() @IsPositive() deliveryFeeInCents!: number;
  @IsOptional() @IsString() idempotencyKey?: string;
}

// --- DTO mappers (entities -> plain API payloads; keeps the HTTP contract flat) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toDto = (entity: any): unknown =>
  entity && typeof entity === 'object' && 'props' in entity ? { ...entity.props } : entity;

// --- Controllers ---

@Controller('products')
@Injectable()
export class ProductsController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get()
  async list() {
    const products = await this.checkoutService.listProducts();
    return { data: products.map(toDto) };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const product = await this.checkoutService.getProduct(id);
    if (!product) throw new NotFoundException('Product not found');
    return { data: toDto(product) };
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
    return { data: toDto(tx) };
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
      ...(dto.idempotencyKey ? { idempotencyKey: dto.idempotencyKey } : {}),
    });

    if (!result.ok) {
      throw mapErrorToException(result.error as CheckoutHttpError);
    }
    return { data: result.value };
  }
}

interface CheckoutHttpError extends Error {
  code?: string;
}

const mapErrorToException = (err: CheckoutHttpError): HttpException => {
  switch (err.code) {
    case 'INSUFFICIENT_STOCK':
      return new ConflictException(err.message);
    case 'PRODUCT_NOT_FOUND':
      return new NotFoundException(err.message);
    case 'PAYMENT_DECLINED':
      return new HttpException(
        { statusCode: 402, error: 'PAYMENT_DECLINED', message: err.message },
        402,
      );
    case 'INVALID_CARD':
      return new HttpException(
        { statusCode: 422, error: 'INVALID_CARD', message: err.message },
        422,
      );
    default:
      return new InternalServerErrorException(err.message);
  }
};