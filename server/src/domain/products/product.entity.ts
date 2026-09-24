// Product domain entity — pure business rules, no framework imports.

export type ProductId = string;

export interface ProductProps {
  id: ProductId;
  name: string;
  description: string;
  priceInCents: number;
  imageUrl: string;
  stock: number;
}

export class Product {
  private constructor(readonly props: ProductProps) {}

  static create(props: ProductProps): Product {
    Product.assertValid(props);
    return new Product({ ...props });
  }

  private static assertValid(props: ProductProps): void {
    if (!props.name.trim()) throw new Error('Product name is required');
    if (props.priceInCents <= 0) throw new Error('Price must be positive');
    if (props.stock < 0) throw new Error('Stock cannot be negative');
  }

  get id(): ProductId {
    return this.props.id;
  }

  get stock(): number {
    return this.props.stock;
  }

  get priceInCents(): number {
    return this.props.priceInCents;
  }

  hasStock(units: number): boolean {
    return this.props.stock >= units;
  }

  decreaseStock(units: number): Product {
    if (!this.hasStock(units)) {
      throw new Error('Insufficient stock');
    }
    return new Product({ ...this.props, stock: this.props.stock - units });
  }
}