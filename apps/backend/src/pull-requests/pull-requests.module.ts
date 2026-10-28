import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IssuesModule } from '../issues/issues.module';
import { PullRequestEntity } from './pull-request.entity';
import { PullRequestReferenceEntity } from './pull-request-reference.entity';
import { PullRequestsService } from './pull-requests.service';
import { PullRequestsController } from './pull-requests.controller';
import { GithubWebhooksController } from './github-webhooks.controller';
import { PullRequestsGateway } from './pull-requests.gateway';
import { PullRequestPollerService } from './pull-request-poller.service';
import { PullRequestReferencesListener } from './pull-request-references.listener';

/** Taico's copy of linked GitHub pull requests: noticing links, polling, webhooks and events. */
@Module({
  imports: [
    TypeOrmModule.forFeature([PullRequestEntity, PullRequestReferenceEntity]),
    IntegrationsModule,
    IssuesModule,
    AuthGuardsModule,
  ],
  controllers: [PullRequestsController, GithubWebhooksController],
  providers: [PullRequestsService, PullRequestsGateway, PullRequestPollerService, PullRequestReferencesListener],
  exports: [PullRequestsService],
})
export class PullRequestsModule {}
