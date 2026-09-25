// API client — thin fetch wrapper over the backend REST API.

import type { CardState, DeliveryState } from '@/store/checkoutSlice';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export interface ProductDto {
  id: string;
  name: string;
  description: string;
  priceInCents: number;
  imageUrl: string;
  stock: number;
}

export interface CheckoutResultDto {
  transactionId: string;
  status: 'APPROVED' | 'DECLINED';
  totalInCents: number;
  receipt: { productRef: string; customerRef: string; deliveryRef: string };
}

export interface CheckoutRequest {
  productId: string;
  units: number;
  card: { number: string; cvv: string; expiryMonth: number; expiryYear: number; holderName: string };
  customer: { fullName: string; email: string; phone: string };
  delivery: { address: string; city: string; postalCode: string };
  deliveryFeeInCents: number;
}

export const DELIVERY_FEE_IN_CENTS = 10000; // delivery fee (cents)
export const BASE_FEE_IN_CENTS = 500; // base fee added always (cents)

export async function fetchProduct(id: string): Promise<ProductDto> {
  const res = await fetch(`${API_BASE}/products/${id}`);
  if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
  const body = (await res.json()) as { data: ProductDto };
  return body.data;
}

export async function checkout(payload: CheckoutRequest): Promise<{
  transactionId: string;
  status: 'APPROVED' | 'DECLINED';
  totalInCents: number;
}> {
  const res = await fetch(`${API_BASE}/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as {
    data?: { transactionId: string; status: 'APPROVED' | 'DECLINED'; totalInCents: number };
    message?: string;
  };
  if (body.data) {
    return body.data;
  }
  throw new Error(body.message ?? 'Checkout failed');
}

// Luhn check + brand detection on the client for instant feedback.
export const isValidLuhn = (raw: string): boolean => {
  const digits = raw.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits) || digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
};

export type CardBrand = 'VISA' | 'MASTERCARD' | 'UNKNOWN';

export const detectBrand = (raw: string): CardBrand => {
  const digits = raw.replace(/[\s-]/g, '');
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(digits)) return 'MASTERCARD';
  return 'UNKNOWN';
};

export const buildCheckoutRequest = (
  productId: string,
  units: number,
  card: CardState,
  delivery: DeliveryState,
): CheckoutRequest => ({
  productId,
  units,
  card: {
    number: card.number,
    cvv: card.cvv,
    expiryMonth: Number(card.expiryMonth),
    // Normalize 2-digit years (YY) to full year (20YY) before sending.
    expiryYear: Number(card.expiryYear) < 100 ? 2000 + Number(card.expiryYear) : Number(card.expiryYear),
    holderName: card.holderName,
  },
  customer: {
    fullName: delivery.fullName,
    email: delivery.email,
    phone: delivery.phone,
  },
  delivery: {
    address: delivery.address,
    city: delivery.city,
    postalCode: delivery.postalCode,
  },
  deliveryFeeInCents: DELIVERY_FEE_IN_CENTS,
});