// Unit tests — Card validation domain service.

import { isValidLuhn, detectBrand, last4, validateCard } from './card-validator';

describe('card-validator', () => {
  describe('isValidLuhn', () => {
    it('accepts a valid VISA test number', () => {
      expect(isValidLuhn('4242 4242 4242 4242')).toBe(true);
    });

    it('accepts a valid MasterCard test number', () => {
      expect(isValidLuhn('5555 5555 5555 4444')).toBe(true);
    });

    it('rejects an invalid checksum', () => {
      expect(isValidLuhn('4242 4242 4242 4241')).toBe(false);
    });

    it('rejects non-numeric input', () => {
      expect(isValidLuhn('abcd')).toBe(false);
    });

    it('rejects too-short numbers', () => {
      expect(isValidLuhn('4242')).toBe(false);
    });
  });

  describe('detectBrand', () => {
    it('detects VISA (starts with 4)', () => {
      expect(detectBrand('4242424242424242')).toBe('VISA');
    });

    it('detects MasterCard (51-55 range)', () => {
      expect(detectBrand('5555555555554444')).toBe('MASTERCARD');
    });

    it('detects MasterCard (2-series 2221-2720)', () => {
      expect(detectBrand('2223003122003222')).toBe('MASTERCARD');
    });

    it('returns UNKNOWN for other brands', () => {
      expect(detectBrand('341234567890123')).toBe('UNKNOWN'); // Amex
    });
  });

  describe('last4', () => {
    it('extracts last 4 digits', () => {
      expect(last4('4242 4242 4242 4242')).toBe('4242');
    });
  });

  describe('validateCard', () => {
    const validCard = {
      number: '4242424242424242',
      cvv: '123',
      expiryMonth: 12,
      expiryYear: new Date().getFullYear() + 1,
      holderName: 'JOHN DOE',
    };

    it('passes for valid card', () => {
      expect(() => validateCard(validCard)).not.toThrow();
    });

    it('rejects bad luhn', () => {
      expect(() => validateCard({ ...validCard, number: '4242424242424241' })).toThrow('Invalid card number');
    });

    it('rejects unknown brand', () => {
      // 34… is a valid Amex luhn number, so the brand check is what fails.
      expect(() => validateCard({ ...validCard, number: '378282246310005' })).toThrow(
        'Only VISA and MasterCard are accepted',
      );
    });

    it('rejects bad cvv', () => {
      expect(() => validateCard({ ...validCard, cvv: '12' })).toThrow('Invalid CVV');
    });

    it('rejects expired year', () => {
      expect(() => validateCard({ ...validCard, expiryYear: 2020 })).toThrow('Card expired');
    });

    it('rejects empty holder', () => {
      expect(() => validateCard({ ...validCard, holderName: '  ' })).toThrow('Holder name is required');
    });
  });
});