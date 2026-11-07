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
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { TagEntity } from './tag.entity';

@Entity({ name: 'projects' })
@Index('UQ_projects_workspace_slug', ['workspaceId', 'slug'], { unique: true })
export class ProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** The workspace this row belongs to. See docs/architecture/workspaces.md. */
  @Index()
  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'text', unique: true })
  tagId!: string;

  @OneToOne(() => TagEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tagId' })
  tag!: TagEntity;

  @ManyToMany(() => TagEntity)
  @JoinTable({
    name: 'project_auto_tags',
    joinColumn: { name: 'project_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  autoTags!: TagEntity[];

  /** Unique per workspace. */
  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  repoUrl?: string;

  /**
   * The GitHub connection used for this project's repository and pull
   * requests. Null: picked automatically from the repository's owner.
   */
  @Column({ type: 'uuid', nullable: true, name: 'github_connection_id' })
  githubConnectionId!: string | null;

  /** Whether workers get a token from the project's GitHub connection to clone and push. */
  @Column({ type: 'boolean', default: false, name: 'github_for_worker' })
  githubForWorker!: boolean;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
