import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ManyToMany,
  ManyToOne,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { TagEntity } from '../meta/tag.entity';
import { ActorEntity } from '../identity-provider/actor.entity';

/**
 * TaskBlueprintEntity represents a template for creating tasks.
 * Unlike regular tasks, blueprints are not part of task listings and serve
 * as reusable templates for scheduled or manual task creation.
 */
@Entity({ name: 'task_blueprints' })
export class TaskBlueprintEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column('text')
  description!: string;

  @Column({ type: 'uuid', nullable: true, name: 'assignee_actor_id' })
  assigneeActorId!: string | null;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'assignee_actor_id' })
  assigneeActor?: ActorEntity;

  @Column({ type: 'uuid', nullable: false, name: 'created_by_actor_id' })
  createdByActorId!: string;

  @ManyToOne(() => ActorEntity)
  @JoinColumn({ name: 'created_by_actor_id' })
  createdByActor?: ActorEntity;

  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'task_blueprint_tags',
    joinColumn: { name: 'task_blueprint_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags!: TagEntity[];

  // Store dependency IDs as JSON array since blueprints reference other task IDs
  @Column({ type: 'text', nullable: true, name: 'depends_on_ids' })
  dependsOnIdsJson!: string | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;

  /**
   * Helper getter to parse dependsOnIds from JSON
   */
  get dependsOnIds(): string[] {
    if (!this.dependsOnIdsJson) return [];
    try {
      return JSON.parse(this.dependsOnIdsJson);
    } catch {
      return [];
    }
  }

  /**
   * Helper setter to serialize dependsOnIds to JSON
   */
  set dependsOnIds(ids: string[]) {
    this.dependsOnIdsJson = ids.length > 0 ? JSON.stringify(ids) : null;
  }
}
