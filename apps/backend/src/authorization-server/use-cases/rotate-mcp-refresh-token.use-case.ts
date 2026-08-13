import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { McpAuthorizationFlowEntity } from '../../auth-journeys/entities';
import {
  ClientIdMismatchError,
  InvalidRefreshTokenError,
  RefreshTokenExpiredError,
  RefreshTokenRevokedError,
} from '../errors/token.errors';
import { McpRefreshTokenEntity } from '../entities/mcp-refresh-token.entity';
import { getConfig } from '../../config/env.config';

export type RotatedMcpRefreshToken = {
  mcpAuthFlow: McpAuthorizationFlowEntity;
  refreshToken: string;
};

/** Atomically consumes an MCP refresh token and creates its successor. */
@Injectable()
export class RotateMcpRefreshTokenUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    presentedRefreshToken: string,
    clientId: string,
  ): Promise<RotatedMcpRefreshToken> {
    const tokenHash = createHash('sha256')
      .update(presentedRefreshToken)
      .digest('hex');
    const refreshToken = randomBytes(32).toString('base64url');
    const successorHash = createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + getConfig().mcpRefreshTokenDurationDays,
    );

    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(McpRefreshTokenEntity);
      const storedToken = await repository.findOne({
        where: { tokenHash },
        relations: [
          'mcpAuthorizationFlow',
          'mcpAuthorizationFlow.client',
          'mcpAuthorizationFlow.server',
          'mcpAuthorizationFlow.authJourney',
          'mcpAuthorizationFlow.authJourney.actor',
          'mcpAuthorizationFlow.authJourney.actor.user',
        ],
      });
      if (!storedToken) throw new InvalidRefreshTokenError();
      if (storedToken.clientId !== clientId) throw new ClientIdMismatchError();
      if (storedToken.revokedAt) throw new RefreshTokenRevokedError();
      if (new Date() > storedToken.expiresAt)
        throw new RefreshTokenExpiredError();

      const now = new Date();
      const result = await repository
        .createQueryBuilder()
        .update(McpRefreshTokenEntity)
        .set({ revokedAt: now })
        .where('id = :id', { id: storedToken.id })
        .andWhere('revoked_at IS NULL')
        .execute();
      if (result.affected !== 1) throw new RefreshTokenRevokedError();

      await repository.save(
        repository.create({
          mcpAuthorizationFlowId: storedToken.mcpAuthorizationFlowId,
          clientId,
          tokenHash: successorHash,
          expiresAt,
          revokedAt: null,
        }),
      );
      return {
        mcpAuthFlow: storedToken.mcpAuthorizationFlow,
        refreshToken,
      };
    });
  }
}
