// Unit tests — Product domain entity.

import { Product } from './product.entity';

const baseProps = {
  id: 'prod_001',
  name: 'Wireless Headphones',
  description: 'Nice headphones',
  priceInCents: 250000,
  imageUrl: 'https://example.com/img.png',
  stock: 10,
};

describe('Product entity', () => {
  it('creates a valid product', () => {
    const product = Product.create({ ...baseProps });
    expect(product.id).toBe('prod_001');
    expect(product.stock).toBe(10);
  });

  it('rejects empty name', () => {
    expect(() => Product.create({ ...baseProps, name: '  ' })).toThrow('Product name is required');
  });

  it('rejects non-positive price', () => {
    expect(() => Product.create({ ...baseProps, priceInCents: 0 })).toThrow('Price must be positive');
  });

  it('rejects negative stock', () => {
    expect(() => Product.create({ ...baseProps, stock: -1 })).toThrow('Stock cannot be negative');
  });

  it('hasStock returns true when enough units', () => {
    const product = Product.create({ ...baseProps });
    expect(product.hasStock(10)).toBe(true);
    expect(product.hasStock(11)).toBe(false);
  });

  it('decreaseStock reduces stock immutably', () => {
    const product = Product.create({ ...baseProps });
    const updated = product.decreaseStock(4);
    expect(updated.stock).toBe(6);
    expect(product.stock).toBe(10); // original unchanged
  });

  it('decreaseStock throws when insufficient', () => {
    const product = Product.create({ ...baseProps });
    expect(() => product.decreaseStock(11)).toThrow('Insufficient stock');
  });
});