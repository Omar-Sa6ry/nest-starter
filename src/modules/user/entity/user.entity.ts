import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
  Check,
} from 'typeorm';
import { Role } from '../../../common/constant/enum.constant.js';

@Entity('users')
@Unique(['email', 'phoneNumber'])
@Check(`"password" IS NOT NULL OR "google_id" IS NOT NULL`)
export class User {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ name: 'password', length: 255, nullable: true })
  passwordHash?: string;

  @Column({ name: 'first_name', length: 100 })
  firstName: string;

  @Column({ name: 'last_name', length: 100 })
  lastName: string;

  @Column({ name: 'phone_number', unique: true, length: 20, nullable: true })
  phoneNumber?: string;

  @Index({ unique: true, where: '"google_id" IS NOT NULL' })
  @Column({
    name: 'google_id',
    type: 'varchar',
    length: 255,
    nullable: true,
    unique: true,
  })
  googleId?: string;

  @Column({ type: 'varchar', default: Role.USER })
  role: Role;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({
    name: 'image_url',
    type: 'varchar',
    length: 1024,
    nullable: true,
    default: null,
  })
  imageUrl?: string;

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
