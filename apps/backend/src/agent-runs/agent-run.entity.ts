import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ActorEntity } from '../identity-provider/actor.entity';
import { TaskEntity } from '../tasks/task.entity';

@Entity({ name: 'agent_runs' })
export class AgentRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'actor_id' })
  actorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'actor_id' })
  actor?: ActorEntity;

  @Column({ type: 'uuid', nullable: false, name: 'parent_task_id' })
  parentTaskId!: string;

  @ManyToOne(() => TaskEntity)
  @JoinColumn({ name: 'parent_task_id' })
  parentTask?: TaskEntity;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @Column({ type: 'datetime', nullable: true, name: 'started_at' })
  startedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, name: 'ended_at' })
  endedAt!: Date | null;

  @Column({ type: 'datetime', nullable: true, name: 'last_ping' })
  lastPing!: Date | null;
}
