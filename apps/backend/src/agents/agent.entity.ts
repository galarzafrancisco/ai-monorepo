import { TaskStatus } from 'src/tasks/enums';
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
import { ActorEntity } from '../identity-provider/actor.entity';
import { AgentType } from './enums';

@Entity({ name: 'agents' })
export class AgentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, unique: true, name: 'actor_id' })
  actorId!: string;

  @OneToOne(() => ActorEntity, (actor) => actor.agent)
  @JoinColumn({ name: 'actor_id' })
  actor?: ActorEntity;

  @Column({ type: 'text', enum: AgentType, default: AgentType.CLAUDE })
  type!: AgentType;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', name: 'system_prompt' })
  systemPrompt!: string;

  @Column({
    type: 'simple-array',
    name: 'status_triggers',
    default: '',
  })
  statusTriggers!: TaskStatus[]

  @Column({
    type: 'simple-array',
    name: 'allowed_tools',
  })
  allowedTools!: string[];

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'integer', nullable: true, name: 'concurrency_limit' })
  concurrencyLimit!: number | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;

  /**
   * Agent name from the associated actor.
   * Returns 'Unknown' as fallback if actor is not loaded.
   */
  get name(): string {
    return this.actor?.displayName ?? 'Unknown';
  }

  /**
   * Agent slug from the associated actor.
   * Returns 'unknown' as fallback if actor is not loaded.
   */
  get slug(): string {
    return this.actor?.slug ?? 'unknown';
  }
}
