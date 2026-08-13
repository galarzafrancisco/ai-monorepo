import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthJourneyStatus } from '../../auth-journeys/enums/auth-journey-status.enum';
import { McpAuthorizationFlowStatus } from '../../auth-journeys/enums/mcp-authorization-flow-status.enum';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { AuthFlowNotFoundError } from '../errors/authorization.errors';

export type StartMcpAuthorizationRequestCommand = {
  flowId: string;
  journeyId: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  state?: string;
  redirectUri: string;
  resource?: string;
  scopes: string[];
};

/** Stores the authorization request and advances its journey atomically. */
@Injectable()
export class StartMcpAuthorizationRequestUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(command: StartMcpAuthorizationRequestCommand): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(McpAuthorizationFlowEntity)
        .createQueryBuilder()
        .update(McpAuthorizationFlowEntity)
        .set({
          status: McpAuthorizationFlowStatus.AUTHORIZATION_REQUEST_STARTED,
          codeChallenge: command.codeChallenge,
          codeChallengeMethod: command.codeChallengeMethod,
          state: command.state,
          redirectUri: command.redirectUri,
          resource: command.resource,
          scopes: command.scopes,
        })
        .where('id = :flowId', { flowId: command.flowId })
        .andWhere('authorization_code IS NULL')
        .execute();
      if (result.affected !== 1)
        throw new AuthFlowNotFoundError(command.flowId);
      await manager
        .getRepository(AuthJourneyEntity)
        .update(
          { id: command.journeyId },
          { status: AuthJourneyStatus.MCP_AUTH_FLOW_STARTED },
        );
    });
  }
}
