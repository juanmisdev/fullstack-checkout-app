// Card validation domain service — Luhn check + brand detection (VISA / MasterCard).

export type CardBrand = 'VISA' | 'MASTERCARD' | 'UNKNOWN';

export interface CardData {
  number: string;
  cvv: string;
  expiryMonth: number;
  expiryYear: number;
  holderName: string;
}

export interface CardValidationResult {
  brand: CardBrand;
  last4: string;
}

/** Strips spaces/dashes from a card number. */
export const normalizeCardNumber = (raw: string): string => raw.replace(/[\s-]/g, '');

/** Luhn algorithm (mod-10 checksum). */
export const isValidLuhn = (rawNumber: string): boolean => {
  const digits = normalizeCardNumber(rawNumber);
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

/** Detects card brand from the IIN prefix. */
export const detectBrand = (rawNumber: string): CardBrand => {
  const digits = normalizeCardNumber(rawNumber);
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(digits)) return 'MASTERCARD';
  return 'UNKNOWN';
};

export const last4 = (rawNumber: string): string =>
  normalizeCardNumber(rawNumber).slice(-4);

/** Validates full card data (structure + expiry + luhn). Throws on invalid. */
export const validateCard = (card: CardData): void => {
  if (!isValidLuhn(card.number)) throw new Error('Invalid card number');
  if (detectBrand(card.number) === 'UNKNOWN') throw new Error('Only VISA and MasterCard are accepted');
  if (!/^\d{3,4}$/.test(card.cvv)) throw new Error('Invalid CVV');
  const now = new Date();
  const currentYear = now.getFullYear();
  if (card.expiryYear < currentYear) throw new Error('Card expired');
  if (card.expiryYear === currentYear && card.expiryMonth < now.getMonth() + 1) {
    throw new Error('Card expired');
  }
  if (card.expiryMonth < 1 || card.expiryMonth > 12) throw new Error('Invalid expiry month');
  if (!card.holderName.trim()) throw new Error('Holder name is required');
};