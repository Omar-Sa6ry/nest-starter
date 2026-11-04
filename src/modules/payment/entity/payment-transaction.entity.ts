import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  type Relation,
} from 'typeorm';
import { IdGenerator } from '@bts-soft/core';
import { PaymentProvider } from '../enums/payment-provider.enum.js';
import { PaymentStatus } from '../enums/payment-status.enum.js';
import { PaymentCurrency } from '../enums/payment-currency.enum.js';
import type { User } from '../../user/entity/user.entity.js';

@Entity('payment_transactions')
export class PaymentTransaction {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string = IdGenerator.generate();

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = IdGenerator.generate();
    }
  }

  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne('User', 'paymentTransactions', {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user?: Relation<User>;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'varchar',
    length: 10,
    default: PaymentCurrency.USD,
  })
  currency: PaymentCurrency;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  provider: PaymentProvider;

  @Index()
  @Column({
    type: 'varchar',
    length: 30,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Index()
  @Column({
    name: 'provider_transaction_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerTransactionId?: string;

  @Column({
    name: 'checkout_url',
    type: 'varchar',
    length: 2048,
    nullable: true,
  })
  checkoutUrl?: string;

  @Column({
    name: 'reference_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  referenceNumber?: string;

  @Column({
    name: 'failure_reason',
    type: 'text',
    nullable: true,
  })
  failureReason?: string;

  @Column({
    type: 'jsonb',
    nullable: true,
    default: () => "'{}'::jsonb",
  })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
