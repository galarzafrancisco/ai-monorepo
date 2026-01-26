import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthJourneysService } from './auth-journeys.service';
import { getConfig } from '../config/env.config';

@Injectable()
export class AuthJourneysCleanupService {
  private readonly logger = new Logger(AuthJourneysCleanupService.name);

  constructor(private readonly authJourneysService: AuthJourneysService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async pruneStaleClients(): Promise<void> {
    const retentionHours = getConfig().mcpClientPruneRetentionHours;
    const result = await this.authJourneysService.pruneStaleMcpClients(retentionHours);

    if (result.staleFlows === 0) {
      this.logger.debug(`No stale MCP clients to prune (cutoff: ${result.cutoff.toISOString()}).`);
      return;
    }

    this.logger.log(
      `Pruned stale MCP clients: ${result.deletedClients} clients, ${result.deletedJourneys} journeys, ${result.deletedMcpFlows} MCP flows, ${result.deletedConnectionFlows} connection flows (cutoff: ${result.cutoff.toISOString()}).`,
    );
  }
}
