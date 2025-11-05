import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { McpScopeEntity } from './mcp-scope.entity';
import { McpConnectionEntity } from './mcp-connection.entity';

@Entity('mcp_scope_mappings')
export class McpScopeMappingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  scopeId!: string;

  @Column({ type: 'uuid' })
  serverId!: string;

  @Column({ type: 'uuid' })
  connectionId!: string;

  @Column({ type: 'varchar', length: 255 })
  downstreamScope!: string;

  @ManyToOne(() => McpScopeEntity, (scope) => scope.mappings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn([
    { name: 'scopeId', referencedColumnName: 'scopeId' },
    { name: 'serverId', referencedColumnName: 'serverId' },
  ])
  scope!: McpScopeEntity;

  @ManyToOne(() => McpConnectionEntity, (connection) => connection.mappings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'connectionId' })
  connection!: McpConnectionEntity;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
