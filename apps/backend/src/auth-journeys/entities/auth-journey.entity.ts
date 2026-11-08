import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AuthJourneyStatus } from '../enums/auth-journey-status.enum';
import { ConnectionAuthorizationFlowEntity } from './connection-authorization-flow.entity';
import { McpAuthorizationFlowEntity } from './mcp-authorization-flow.entity';
import { ActorEntity } from 'src/identity-provider/actor.entity';
import { WorkspaceEntity } from 'src/workspaces/workspace.entity';

@Entity('authorization_journeys')
export class AuthJourneyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'text',
    default: AuthJourneyStatus.NOT_STARTED,
  })
  status!: AuthJourneyStatus;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string | null;

  @ManyToOne(() => ActorEntity, { nullable: true })
  @JoinColumn({ name: 'actor_id' })
  actor?: ActorEntity | null;

  /**
   * The workspace the person was working in when they consented. Tokens for
   * Taico's own servers (tasks, context, workers) are minted for it, so a
   * worker connects to the workspace it was authorized in. Null for journeys
   * from before this was recorded: those use the person's oldest membership.
   */
  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  workspaceId?: string | null;

  @ManyToOne(() => WorkspaceEntity, { nullable: true })
  @JoinColumn({ name: 'workspace_id' })
  workspace?: WorkspaceEntity | null;

  // Many connection authorization flows can be linked to this one
  @OneToMany(
    () => ConnectionAuthorizationFlowEntity,
    (connectionAuthenticationFlow) => connectionAuthenticationFlow.authJourney,
  )
  connectionAuthorizationFlows!: ConnectionAuthorizationFlowEntity[];

  @OneToOne(
    () => McpAuthorizationFlowEntity,
    (mcpAuthenticationFlow) => mcpAuthenticationFlow.authJourney,
  )
  mcpAuthorizationFlow!: McpAuthorizationFlowEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
