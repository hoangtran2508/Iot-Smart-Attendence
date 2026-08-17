import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Location } from './location.entity';

@Entity({ name: 'devices' })
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  clientId!: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  name?: string | null;

  @Column({ type: 'uuid' })
  locationId!: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ipAddress?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt?: Date | null;

  @ManyToOne(() => Location, (location) => location.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location!: Location;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
