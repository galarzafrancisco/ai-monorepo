import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuardsModule } from '../auth/guards/auth-guards.module';
import { SecretsModule } from '../secrets/secrets.module';
import { GithubConnectionEntity } from './github-connection.entity';
import { GithubConnectionsService } from './github-connections.service';
import { GithubConnectionsController } from './github-connections.controller';
import { GithubCredentialsService } from './github/github-credentials.service';
import { WorkerGithubCredentialsService } from './github/worker-github-credentials.service';

/** Connections to outside services. Today: GitHub. */
@Module({
  imports: [TypeOrmModule.forFeature([GithubConnectionEntity]), SecretsModule, AuthGuardsModule],
  controllers: [GithubConnectionsController],
  providers: [GithubConnectionsService, GithubCredentialsService, WorkerGithubCredentialsService],
  exports: [GithubConnectionsService, GithubCredentialsService, WorkerGithubCredentialsService],
})
export class IntegrationsModule {}
