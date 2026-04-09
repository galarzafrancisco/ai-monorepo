import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AgentEntity } from './agent.entity';
import { McpServerEntity } from '../mcp-registry/entities/mcp-server.entity';
import { AgentToolPermissionScopeEntity } from './agent-tool-permission-scope.entity';

@Entity({ name: 'agent_tool_permissions' })
export class AgentToolPermissionEntity {
  @PrimaryColumn({ type: 'uuid', name: 'agent_actor_id' })
  agentActorId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'server_id' })
  serverId!: string;

  @ManyToOne(() => AgentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_actor_id', referencedColumnName: 'actorId' })
  agent!: AgentEntity;

  @ManyToOne(() => McpServerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'server_id', referencedColumnName: 'id' })
  server!: McpServerEntity;

  @OneToMany(() => AgentToolPermissionScopeEntity, (scope) => scope.permission)
  grantedScopes!: AgentToolPermissionScopeEntity[];

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt!: Date;
}
