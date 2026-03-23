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
import { MCP_SERVER_TYPE_HTTP } from '../mcp-server.types';
import type { McpServerType } from '../mcp-server.types';

@Entity('mcp_servers')
export class McpServerEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  providedId!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', default: MCP_SERVER_TYPE_HTTP })
  type!: McpServerType;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  url?: string;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  cmd?: string;

  @Column({ type: 'simple-json', nullable: true })
  args?: string[];

  @OneToMany(() => McpScopeEntity, (scope) => scope.server, { cascade: true })
  scopes!: McpScopeEntity[];

  @OneToMany(() => McpConnectionEntity, (connection) => connection.server, {
    cascade: true,
  })
  connections!: McpConnectionEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
