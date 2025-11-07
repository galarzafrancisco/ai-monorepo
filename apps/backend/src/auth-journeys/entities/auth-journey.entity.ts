import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { AuthJourneyStatus } from '../enums/auth-journey-status.enum';
import { ConnectionAuthorizationFlowEntity } from './connection-authorization-flow.entity';
import { McpAuthorizationFlowEntity } from './mcp-authorization-flow.entity';

@Entity('authorization_journeys')
export class AuthJourneyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'text',
    default: AuthJourneyStatus.NOT_STARTED,
  })
  status!: AuthJourneyStatus;

  // Many connection authorization flows can be linked to this one
  @OneToMany(() => ConnectionAuthorizationFlowEntity, (connectionAuthenticationFlow) => connectionAuthenticationFlow.authJourney)
  connectionAuthorizationFlows!: ConnectionAuthorizationFlowEntity[];

  @OneToOne(() => McpAuthorizationFlowEntity, (mcpAuthenticationFlow) => mcpAuthenticationFlow.authJourney)
  mcpAuthorizationFlow!: McpAuthorizationFlowEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt?: Date | null;
}
