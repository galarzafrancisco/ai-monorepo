import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthJourneyStatus } from '../../auth-journeys/enums/auth-journey-status.enum';
import { McpAuthorizationFlowStatus } from '../../auth-journeys/enums/mcp-authorization-flow-status.enum';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { AuthFlowAlreadyCompletedError } from '../errors/authorization.errors';

/** Atomically records an explicit user consent denial. */
@Injectable()
export class RejectMcpConsentUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(flowId: string, journeyId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(McpAuthorizationFlowEntity)
        .createQueryBuilder()
        .update(McpAuthorizationFlowEntity)
        .set({ status: McpAuthorizationFlowStatus.USER_CONSENT_REJECTED })
        .where('id = :flowId', { flowId })
        .andWhere('authorization_code IS NULL')
        .execute();
      if (result.affected !== 1)
        throw new AuthFlowAlreadyCompletedError(flowId);
      await manager
        .getRepository(AuthJourneyEntity)
        .update(
          { id: journeyId },
          { status: AuthJourneyStatus.USER_CONSENT_REJECTED },
        );
    });
  }
}
