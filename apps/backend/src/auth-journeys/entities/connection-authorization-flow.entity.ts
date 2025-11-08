import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AuthJourneyEntity } from './auth-journey.entity';
import { McpConnectionEntity } from '../../mcp-registry/entities/mcp-connection.entity';

@Entity('connection_authorization_flows')
export class ConnectionAuthorizationFlowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'authorization_journey_id' })
  authorizationJourneyId!: string;

  @Column({ type: 'uuid', name: 'mcp_connection_id' })
  mcpConnectionId!: string;

  // One Auth Journey can have many Connection Flows, but each connection flow only belongs to 1 Auth Journey
  @ManyToOne(
    () => AuthJourneyEntity,
    (journey) => journey.connectionAuthorizationFlows,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'authorization_journey_id' })
  authJourney!: AuthJourneyEntity;

  // One connection flow maps to one mcp connection, but the connection can have many flows.
  @ManyToOne(() => McpConnectionEntity, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'mcp_connection_id' })
  mcpConnection!: McpConnectionEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
