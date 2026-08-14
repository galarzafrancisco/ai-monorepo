import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthJourneyStatus } from '../../auth-journeys/enums/auth-journey-status.enum';
import { McpAuthorizationFlowStatus } from '../../auth-journeys/enums/mcp-authorization-flow-status.enum';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { AuthFlowAlreadyCompletedError } from '../errors/authorization.errors';

/** Records consent and optional authenticated actor binding as one state transition. */
@Injectable()
export class ApproveMcpConsentUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    flowId: string,
    journeyId: string,
    actorId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(McpAuthorizationFlowEntity)
        .createQueryBuilder()
        .update(McpAuthorizationFlowEntity)
        .set({ status: McpAuthorizationFlowStatus.USER_CONSENT_OK })
        .where('id = :flowId', { flowId })
        .andWhere('authorization_code IS NULL')
        .andWhere('status = :status', {
          status: McpAuthorizationFlowStatus.AUTHORIZATION_REQUEST_STARTED,
        })
        .execute();
      if (result.affected !== 1)
        throw new AuthFlowAlreadyCompletedError(flowId);
      await manager.getRepository(AuthJourneyEntity).update(
        { id: journeyId },
        {
          status: AuthJourneyStatus.MCP_AUTH_FLOW_COMPLETED,
          ...(actorId ? { actorId } : {}),
        },
      );
    });
  }
}
