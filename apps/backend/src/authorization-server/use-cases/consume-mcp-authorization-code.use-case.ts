import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { AuthJourneyStatus } from '../../auth-journeys/enums/auth-journey-status.enum';
import { McpAuthorizationFlowStatus } from '../../auth-journeys/enums/mcp-authorization-flow-status.enum';
import { AuthJourneyEntity } from '../../auth-journeys/entities/auth-journey.entity';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities/mcp-authorization-flow.entity';
import { getConfig } from '../../config/env.config';
import { AuthorizationCodeUsedError } from '../errors/token.errors';
import { McpRefreshTokenEntity } from '../entities/mcp-refresh-token.entity';

/** Atomically marks an authorization code used and persists its first refresh token. */
@Injectable()
export class ConsumeMcpAuthorizationCodeUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    flow: McpAuthorizationFlowEntity,
    clientId: string,
  ): Promise<string> {
    const refreshToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + getConfig().mcpRefreshTokenDurationDays,
    );

    await this.dataSource.transaction(async (manager) => {
      const flowRepository = manager.getRepository(McpAuthorizationFlowEntity);
      const transition = await flowRepository
        .createQueryBuilder()
        .update(McpAuthorizationFlowEntity)
        .set({
          authorizationCodeUsed: true,
          status: McpAuthorizationFlowStatus.AUTHORIZATION_CODE_EXCHANGED,
        })
        .where('id = :id', { id: flow.id })
        .andWhere('authorization_code_used = 0')
        .execute();
      if (transition.affected !== 1) throw new AuthorizationCodeUsedError();

      await manager
        .getRepository(AuthJourneyEntity)
        .update(
          { id: flow.authorizationJourneyId },
          { status: AuthJourneyStatus.AUTHORIZATION_CODE_EXCHANGED },
        );
      const refreshRepository = manager.getRepository(McpRefreshTokenEntity);
      await refreshRepository.save(
        refreshRepository.create({
          mcpAuthorizationFlowId: flow.id,
          clientId,
          tokenHash,
          expiresAt,
          revokedAt: null,
        }),
      );
    });
    return refreshToken;
  }
}
