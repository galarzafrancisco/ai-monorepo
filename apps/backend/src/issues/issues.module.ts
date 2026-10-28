import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IssueEntity } from './issue.entity';
import { IssueReferenceEntity } from './issue-reference.entity';
import { IssuesService } from './issues.service';
import { IssuesController } from './issues.controller';
import { IssuesGateway } from './issues.gateway';
import { IssuePollerService } from './issue-poller.service';
import { IssueReferencesListener } from './issue-references.listener';

/** Taico's copy of linked GitHub issues: noticing links, polling and events. Webhooks arrive through PullRequestsModule. */
@Module({
  imports: [TypeOrmModule.forFeature([IssueEntity, IssueReferenceEntity]), IntegrationsModule, AuthGuardsModule],
  controllers: [IssuesController],
  providers: [IssuesService, IssuesGateway, IssuePollerService, IssueReferencesListener],
  exports: [IssuesService],
})
export class IssuesModule {}
