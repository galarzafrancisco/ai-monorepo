import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { McpServerEntity } from './mcp-server.entity';
import { McpScopeMappingEntity } from './mcp-scope-mapping.entity';

@Entity('mcp_connections')
export class McpConnectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  serverId!: string;

  @Column({ type: 'varchar', length: 255 })
  friendlyName!: string;

  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  providedId?: string;

  @Column({ type: 'varchar', length: 500 })
  clientId!: string;

  @Column({ type: 'text' })
  clientSecret!: string;

  @Column({ type: 'text' })
  authorizeUrl!: string;

  @Column({ type: 'text' })
  tokenUrl!: string;

  @ManyToOne(() => McpServerEntity, (server) => server.connections, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'serverId' })
  server!: McpServerEntity;

  @OneToMany(() => McpScopeMappingEntity, (mapping) => mapping.connection)
  mappings!: McpScopeMappingEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
