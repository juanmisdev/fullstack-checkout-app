// Transaction domain — pure state machine for payment lifecycle.

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'ERROR';

export interface TransactionProps {
  id: string;
  productRef: string;
  customerRef: string;
  amountInCents: number;
  baseFeeInCents: number;
  deliveryFeeInCents: number;
  status: TransactionStatus;
  gatewayTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Transaction {
  private constructor(readonly props: TransactionProps) {}

  static createPending(
    data: Omit<TransactionProps, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'gatewayTransactionId'> & {
      id: string;
    },
  ): Transaction {
    if (data.amountInCents <= 0) throw new Error('Amount must be positive');
    return new Transaction({
      ...data,
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  static fromPersistence(props: TransactionProps): Transaction {
    return new Transaction({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get status(): TransactionStatus {
    return this.props.status;
  }

  totalInCents(): number {
    return this.props.amountInCents + this.props.baseFeeInCents + this.props.deliveryFeeInCents;
  }

  private withStatus(status: TransactionStatus, gatewayTransactionId?: string): Transaction {
    return new Transaction({
      ...this.props,
      status,
      gatewayTransactionId: gatewayTransactionId ?? this.props.gatewayTransactionId,
      updatedAt: new Date(),
    });
  }

  approve(gatewayTransactionId: string): Transaction {
    if (this.props.status !== 'PENDING') throw new Error('Only PENDING transactions can be approved');
    return this.withStatus('APPROVED', gatewayTransactionId);
  }

  decline(gatewayTransactionId?: string): Transaction {
    if (this.props.status !== 'PENDING') throw new Error('Only PENDING transactions can be declined');
    return this.withStatus('DECLINED', gatewayTransactionId);
  }

  isPending(): boolean {
    return this.props.status === 'PENDING';
  }
}