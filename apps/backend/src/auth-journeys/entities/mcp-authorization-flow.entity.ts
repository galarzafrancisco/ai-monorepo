import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { McpServerEntity } from '../../mcp-registry/entities/mcp-server.entity';
import { RegisteredClientEntity } from '../../authorization-server/registered-client.entity';
import { AuthJourneyEntity } from './auth-journey.entity';


@Entity('mcp_authorization_flows')
export class McpAuthorizationFlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'authorization_journey_id' })
  authorizationJourneyId!: string;

  @Column({ type: 'uuid', name: 'server_id' })
  serverId!: string;

  @Column({ type: 'uuid', name: 'client_id' })
  clientId!: string;

  // An MCP Authorization Flow links to only one Journey
  @OneToOne(() => AuthJourneyEntity)
  @JoinColumn({ name: 'authorization_journey_id' })
  authJourney!: AuthJourneyEntity;

  // An MCP Authorization Flow refers to only one MCP Server
  @ManyToOne(() => McpServerEntity, (server) => server.mcpAuthorizationFlows, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'server_id' })
  server!: McpServerEntity;

  // An MCP Authorization Flow refers to only one MCP Client
  @OneToOne(() => RegisteredClientEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'client_id' })
  client!: RegisteredClientEntity;
  
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
