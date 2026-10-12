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

  @Column({ type: 'text', nullable: true })
  introduction!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  /**
   * Set when the actor's agent or user is deleted. A plain column rather than
   * a DeleteDateColumn on purpose: TypeORM would otherwise drop deleted actors
   * from every relation join, and tasks, comments and context blocks must keep
   * resolving the actor that touched them.
   */
  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;

  @OneToOne(() => User, (user) => user.actor)
  user?: User;

  @OneToOne(() => AgentEntity, (agent) => agent.actor)
  agent?: AgentEntity;
}
