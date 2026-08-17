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

@Entity({ name: 'checkins' })
export class CheckIn {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  locationId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location!: Location;

  @Column({ type: 'timestamptz' })
  checkedInAt!: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note?: string | null;

  @Column({ type: 'varchar', length: 20, default: 'success' })
  status!: 'success' | 'late' | 'fraud';

  @Column({ type: 'varchar', length: 20, default: 'unknown' })
  direction!: 'in' | 'out' | 'unknown';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
