import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Location } from './location.entity';
import { User } from './user.entity';

@Entity({ name: 'pending_enrollments' })
export class PendingEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  locationId!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: 'pending' | 'success' | 'failed';

  @Column({ type: 'integer', nullable: true })
  fingerId?: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  error?: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location!: Location;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
