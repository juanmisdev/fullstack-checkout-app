// Unit tests — Customer and Delivery domain entities.

import { Customer, Delivery } from './customer.entity';

describe('Customer entity', () => {
  it('creates a valid customer', () => {
    const c = Customer.create({ id: 'cus_1', fullName: 'John Doe', email: 'john@example.com', phone: '+573001234567' });
    expect(c.id).toBe('cus_1');
    expect(c.props.createdAt).toBeInstanceOf(Date);
  });

  it('rejects empty name', () => {
    expect(() => Customer.create({ id: 'c', fullName: ' ', email: 'j@x.com', phone: '1' })).toThrow(
      'Full name is required',
    );
  });

  it('rejects invalid email', () => {
    expect(() => Customer.create({ id: 'c', fullName: 'John', email: 'not-an-email', phone: '1' })).toThrow(
      'Invalid email',
    );
  });

  it('rejects empty phone', () => {
    expect(() => Customer.create({ id: 'c', fullName: 'John', email: 'j@x.com', phone: ' ' })).toThrow(
      'Phone is required',
    );
  });
});

describe('Delivery entity', () => {
  const base = {
    id: 'd_1',
    transactionRef: 'tx_1',
    customerRef: 'cus_1',
    productRef: 'prod_001',
    address: 'Calle 1 #2-3',
    city: 'Bogota',
    postalCode: '110111',
  };

  it('creates a delivery in PENDING', () => {
    const d = Delivery.create({ ...base });
    expect(d.props.status).toBe('PENDING');
  });

  it('rejects empty address', () => {
    expect(() => Delivery.create({ ...base, address: ' ' })).toThrow('Address is required');
  });

  it('rejects empty city', () => {
    expect(() => Delivery.create({ ...base, city: ' ' })).toThrow('City is required');
  });
});