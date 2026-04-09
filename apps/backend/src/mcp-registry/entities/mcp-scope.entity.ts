import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  OneToMany,
} from 'typeorm';
import { McpServerEntity } from './mcp-server.entity';
import { McpScopeMappingEntity } from './mcp-scope-mapping.entity';
import { AgentToolPermissionScopeEntity } from 'src/agents/agent-tool-permission-scope.entity';

@Entity('mcp_scopes')
export class McpScopeEntity {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id!: string;

  @PrimaryColumn({ type: 'uuid' })
  serverId!: string;

  @Column({ type: 'text' })
  description!: string;

  @ManyToOne(() => McpServerEntity, (server) => server.scopes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serverId' })
  server!: McpServerEntity;

  @OneToMany(() => McpScopeMappingEntity, (mapping) => mapping.scope)
  mappings!: McpScopeMappingEntity[];

  @OneToMany(
    () => AgentToolPermissionScopeEntity,
    (permissionScope) => permissionScope.scope,
  )
  agentToolPermissionScopes!: AgentToolPermissionScopeEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
