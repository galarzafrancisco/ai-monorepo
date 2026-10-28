import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { GithubConnectionsService } from '../github-connections.service';
import { GithubAuthType } from '../enums';
import { GithubCredentialsService } from './github-credentials.service';
import { parseGithubRepoUrl } from './github-repo-ref';

export type WorkerGithubCredential = {
  projectSlug: string;
  /** HTTPS clone URL: a token works over HTTPS, not SSH. */
  cloneUrl: string;
  owner: string;
  repo: string;
  token: string;
  /** Null for a personal access token. */
  expiresAt: Date | null;
  authType: GithubAuthType;
  connectionName: string;
};

/**
 * Tokens a worker may use for a task: one per project of the task that has a
 * github.com repository, opts in to worker use (`github_for_worker`) and
 * resolves to a connection. A GitHub App gives a fresh installation token
 * limited to that one repository; a personal access token is handed over as is.
 */
@Injectable()
export class WorkerGithubCredentialsService {
  private readonly logger = new Logger(WorkerGithubCredentialsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly connections: GithubConnectionsService,
    private readonly credentials: GithubCredentialsService,
  ) {}

  async issueForTask(taskId: string, audit: { executionId: string; workerClientId: string }): Promise<WorkerGithubCredential[]> {
    const projects: Array<{ slug: string; repo_url: string | null; github_connection_id: string | null }> =
      await this.dataSource.query(
        `SELECT p.slug, p."repoUrl" AS repo_url, p.github_connection_id
           FROM task_tags tt
           JOIN projects p ON p."tagId" = tt.tag_id AND p.deleted_at IS NULL
          WHERE tt.task_id = $1 AND p.github_for_worker = true
          ORDER BY p.slug ASC`,
        [taskId],
      );

    const issued: WorkerGithubCredential[] = [];
    for (const project of projects) {
      const ref = parseGithubRepoUrl(project.repo_url);
      if (!ref) continue;
      const resolved = await this.connections.resolveForRepository({
        owner: ref.owner,
        projectConnectionId: project.github_connection_id,
      });
      if (!resolved) continue;

      const source = await this.connections.getCredentialSource(resolved.connection.id);
      const token =
        source.authType === GithubAuthType.APP
          ? await this.credentials.mintScopedInstallationToken(source, [ref.repo])
          : await this.credentials.getAccessToken(source);

      issued.push({
        projectSlug: project.slug,
        cloneUrl: `https://github.com/${ref.owner}/${ref.repo}.git`,
        owner: ref.owner,
        repo: ref.repo,
        token: token.token,
        expiresAt: token.expiresAt,
        authType: source.authType,
        connectionName: resolved.connection.name,
      });
      this.logger.log({
        message: 'Issued a GitHub token to a worker',
        taskId,
        executionId: audit.executionId,
        workerClientId: audit.workerClientId,
        project: project.slug,
        repository: `${ref.owner}/${ref.repo}`,
        connectionId: resolved.connection.id,
        authType: source.authType,
      });
    }
    return issued;
  }
}
