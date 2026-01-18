import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ActorEntity } from './actor.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  @Column()
  passwordHash!: string;

  @Column({ type: 'uuid', unique: true, name: 'actor_id' })
  actorId!: string;

  @OneToOne(() => ActorEntity, (actor) => actor.user)
  @JoinColumn({ name: 'actor_id' })
  actor?: ActorEntity;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', default: 'standard' })
  role!: 'admin' | 'standard';

  @VersionColumn()
  rowVersion!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt!: Date | null;
}
