import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { McpScopeEntity } from './mcp-scope.entity';
import { McpConnectionEntity } from './mcp-connection.entity';
import { McpAuthorizationFlowEntity } from 'src/auth-journeys/entities';

@Entity('mcp_servers')
export class McpServerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  providedId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @OneToMany(() => McpScopeEntity, (scope) => scope.server, { cascade: true })
  scopes!: McpScopeEntity[];

  @OneToMany(() => McpConnectionEntity, (connection) => connection.server, {
    cascade: true,
  })
  connections!: McpConnectionEntity[];

  // Many MCP Authorization Flows can refer to one MCP Server
  @OneToMany(() => McpAuthorizationFlowEntity, (flow) => flow.server)
  mcpAuthorizationFlows!: McpAuthorizationFlowEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
