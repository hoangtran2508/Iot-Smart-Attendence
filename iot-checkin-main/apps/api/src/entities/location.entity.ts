import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Device } from './device.entity';
import { Fingerprint } from './fingerprint.entity';
import { User } from './user.entity';

@Entity({ name: 'locations' })
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ type: 'varchar', length: 10, unique: true, nullable: true })
  joinCode!: string;


  @Column({ type: 'varchar', length: 255, nullable: true })
  address?: string | null;

  @Column({ type: 'double precision' })
  lat!: number;

  @Column({ type: 'double precision' })
  lng!: number;



  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'adminId' })
  admin?: User;

  @ManyToMany(() => User, (user) => user.locations)
  @JoinTable({
    name: 'location_users',
    joinColumn: { name: 'locationId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'userId', referencedColumnName: 'id' },
  })
  users?: User[];

  @OneToMany(() => Device, (device) => device.location)
  devices?: Device[];

  @OneToMany(() => Fingerprint, (fingerprint) => fingerprint.location)
  fingerprints?: Fingerprint[];

  @Column({ type: 'varchar', length: 10, default: '08:00' })
  startTime!: string;

  @Column({ type: 'varchar', length: 10, default: '17:00' })
  endTime!: string;

  @Column({ type: 'boolean', default: false })
  freeAccessEnabled!: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  freeAccessStartTime?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  freeAccessEndTime?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  workSchedule?: Record<number, { enabled: boolean; startTime: string; endTime: string }> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
