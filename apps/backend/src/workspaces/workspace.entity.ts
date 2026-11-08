import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';

/**
 * A company or team's own space in Taico. Its members, agents and data are
 * kept apart from every other workspace.
 *
 * See docs/architecture/workspaces.md.
 */
@Entity({ name: 'workspaces' })
@Unique('UQ_workspaces_slug', ['slug'])
export class WorkspaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text' })
  name!: string;

  /**
   * When the one-time startup backfill of pre-workspace memberships finished.
   * Only set on the default workspace. Once set the backfill never runs
   * again, so a person removed from every workspace stays out after a
   * restart. See `WorkspacesService.onModuleInit`.
   */
  @Column({ type: 'timestamptz', name: 'members_backfilled_at', nullable: true })
  membersBackfilledAt?: Date | null;

  @VersionColumn({ name: 'row_version' })
  rowVersion!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
