import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeUpdate,
} from 'typeorm';
import { TaskEntity } from './task.entity';
import { ActorEntity } from '../identity-provider/actor.entity';

@Entity({ name: 'task_input_requests' })
export class InputRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'task_id' })
  taskId!: string;

  @ManyToOne(() => TaskEntity, (task) => task.inputRequests)
  @JoinColumn({ name: 'task_id' })
  task!: TaskEntity;

  @Column({ type: 'uuid', name: 'asked_by_actor_id' })
  askedByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'asked_by_actor_id' })
  askedByActor?: ActorEntity;

  @Column({ type: 'uuid', name: 'assigned_to_actor_id' })
  assignedToActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'assigned_to_actor_id' })
  assignedToActor?: ActorEntity;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'text', nullable: true })
  answer!: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'resolved_at' })
  resolvedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @BeforeUpdate()
  updateResolvedAt() {
    // Automatically set resolvedAt when answer is set
    if (this.answer && !this.resolvedAt) {
      this.resolvedAt = new Date();
    }
  }
}
