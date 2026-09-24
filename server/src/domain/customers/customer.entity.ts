// Customer + Delivery domain entities — pure business rules.

export interface CustomerProps {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  createdAt: Date;
}

export class Customer {
  private constructor(readonly props: CustomerProps) {}

  static create(data: Omit<CustomerProps, 'createdAt'> & { createdAt?: Date }): Customer {
    if (!data.fullName.trim()) throw new Error('Full name is required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('Invalid email');
    if (!data.phone.trim()) throw new Error('Phone is required');
    return new Customer({ ...data, createdAt: data.createdAt ?? new Date() });
  }

  static fromPersistence(props: CustomerProps): Customer {
    return new Customer({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
}

export type DeliveryStatus = 'PENDING' | 'SHIPPED' | 'DELIVERED';

export interface DeliveryProps {
  id: string;
  transactionRef: string;
  customerRef: string;
  productRef: string;
  address: string;
  city: string;
  postalCode: string;
  status: DeliveryStatus;
  createdAt: Date;
}

export class Delivery {
  private constructor(readonly props: DeliveryProps) {}

  static create(data: Omit<DeliveryProps, 'status' | 'createdAt'>): Delivery {
    if (!data.address.trim()) throw new Error('Address is required');
    if (!data.city.trim()) throw new Error('City is required');
    return new Delivery({
      ...data,
      status: 'PENDING',
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: DeliveryProps): Delivery {
    return new Delivery({ ...props });
  }

  get id(): string {
    return this.props.id;
  }
}

function Transaction__DeliveryInner(data: Omit<DeliveryProps, 'status' | 'createdAt'>): Delivery {
  return Delivery.fromPersistence({
    ...data,
    status: 'PENDING',
    createdAt: new Date(),
  });
}