import { Controller, Headers, HttpCode, Logger, Param, ParseUUIDPipe, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { ApiAcceptedResponse, ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { GithubConnectionsService } from '../integrations/github-connections.service';
import { PullRequestsService } from './pull-requests.service';
import { pullRequestTargetsOf } from './github/webhook-payload';

/**
 * Receives GitHub webhooks for a connection. Public, but every delivery must
 * carry a valid `X-Hub-Signature-256` made with the connection's webhook
 * secret. Deliveries only say "look again": the pull request is then read
 * through the API like any other refresh, so a forged or replayed payload
 * cannot plant state.
 */
@ApiExcludeController()
@Controller('integrations/github/webhooks')
export class GithubWebhooksController {
  private readonly logger = new Logger(GithubWebhooksController.name);

  constructor(
    private readonly connections: GithubConnectionsService,
    private readonly pullRequests: PullRequestsService,
  ) {}

  @Post(':connectionId')
  @HttpCode(202)
  @ApiAcceptedResponse({ description: 'Delivery accepted' })
  async receive(
    @Param('connectionId', new ParseUUIDPipe()) connectionId: string,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ accepted: true }> {
    const rawBody = request.rawBody;
    if (!rawBody || !(await this.connections.acceptWebhookDelivery(connectionId, rawBody, signature))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const { host } = await this.connections.getConnection(connectionId);
    for (const target of pullRequestTargetsOf(event, request.body)) {
      const marked = await this.pullRequests.markChanged({ host, ...target });
      if (marked > 0) {
        this.logger.log({ message: 'Webhook marked pull requests for a fresh look', event, ...target, marked });
      }
    }
    return { accepted: true };
  }
}
