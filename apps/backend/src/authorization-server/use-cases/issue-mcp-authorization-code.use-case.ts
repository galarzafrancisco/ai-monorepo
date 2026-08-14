import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { AuthJourneyStatus } from '../../auth-journeys/enums/auth-journey-status.enum';
import { McpAuthorizationFlowStatus } from '../../auth-journeys/enums/mcp-authorization-flow-status.enum';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { AuthorizationCodeUsedError } from '../errors/token.errors';

/** Conditionally issues exactly one authorization code for a completed flow. */
@Injectable()
export class IssueMcpAuthorizationCodeUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(flowId: string, journeyId: string): Promise<string> {
    const authorizationCode = randomBytes(32).toString('base64url');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .getRepository(McpAuthorizationFlowEntity)
        .createQueryBuilder()
        .update(McpAuthorizationFlowEntity)
        .set({
          authorizationCode,
          authorizationCodeExpiresAt: expiresAt,
          authorizationCodeUsed: false,
          status: McpAuthorizationFlowStatus.AUTHORIZATION_CODE_ISSUED,
        })
        .where('id = :flowId', { flowId })
        .andWhere('authorization_code IS NULL')
        .execute();
      if (result.affected !== 1) throw new AuthorizationCodeUsedError();
      await manager
        .getRepository(AuthJourneyEntity)
        .update(
          { id: journeyId },
          { status: AuthJourneyStatus.AUTHORIZATION_CODE_ISSUED },
        );
    });
    return authorizationCode;
  }
}
