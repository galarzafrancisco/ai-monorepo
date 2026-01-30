import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  VersionColumn,
  ManyToMany,
} from 'typeorm';
import { TaskEntity } from '../tasks/task.entity';
import { ContextBlockEntity } from 'src/context/block.entity';
import { ThreadEntity } from '../threads/thread.entity';

@Entity({ name: 'tags' })
export class TagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', unique: true, collation: 'NOCASE' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  color?: string;

  @ManyToMany(() => TaskEntity, (task) => task.tags, { onDelete: 'CASCADE' })
  tasks!: TaskEntity[];

  @ManyToMany(() => ContextBlockEntity, (block) => block.tags, {
    onDelete: 'CASCADE',
  })
  blocks!: ContextBlockEntity[];

  @ManyToMany(() => ThreadEntity, (thread) => thread.tags, {
    onDelete: 'CASCADE',
  })
  threads!: ThreadEntity[];

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
