import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ThreadEntity } from './thread.entity';
import { ActorEntity } from '../identity-provider/actor.entity';

@Entity({ name: 'thread_messages' })
export class ThreadMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false, name: 'thread_id' })
  threadId!: string;

  @ManyToOne(() => ThreadEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'thread_id' })
  thread?: ThreadEntity;

  @Column({ type: 'text', nullable: false })
  content!: string;

  @Column({ type: 'uuid', nullable: false, name: 'created_by_actor_id' })
  createdByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_by_actor_id' })
  createdByActor?: ActorEntity;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;
}
