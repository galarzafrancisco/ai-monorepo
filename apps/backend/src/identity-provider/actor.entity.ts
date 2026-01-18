import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { ActorType } from './enums';
import { User } from './user.entity';
import { AgentEntity } from '../agents/agent.entity';

@Entity('actors')
export class ActorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', enum: ActorType })
  type!: ActorType;

  @Column({ type: 'text', unique: true })
  slug!: string;

  @Column({ type: 'text', name: 'display_name' })
  displayName!: string;

  @Column({ type: 'text', nullable: true, name: 'avatar_url' })
  avatarUrl!: string | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @OneToOne(() => User, (user) => user.actor)
  user?: User;

  @OneToOne(() => AgentEntity, (agent) => agent.actor)
  agent?: AgentEntity;
}
