import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgentToolPermissionEntity } from './agent-tool-permission.entity';
import { McpScopeEntity } from '../mcp-registry/entities/mcp-scope.entity';

@Entity({ name: 'agent_tool_permission_scopes' })
export class AgentToolPermissionScopeEntity {
  @PrimaryColumn({ type: 'uuid', name: 'agent_actor_id' })
  agentActorId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'server_id' })
  serverId!: string;

  @PrimaryColumn({ type: 'varchar', length: 255, name: 'scope_id' })
  scopeId!: string;

  @ManyToOne(
    () => AgentToolPermissionEntity,
    (permission) => permission.grantedScopes,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn([
    { name: 'agent_actor_id', referencedColumnName: 'agentActorId' },
    { name: 'server_id', referencedColumnName: 'serverId' },
  ])
  permission!: AgentToolPermissionEntity;

  @ManyToOne(() => McpScopeEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'scope_id', referencedColumnName: 'id' },
    { name: 'server_id', referencedColumnName: 'serverId' },
  ])
  scope!: McpScopeEntity;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
