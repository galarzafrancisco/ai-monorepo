import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getConfig } from '../config/env.config';
import { SecretsService } from '../secrets/secrets.service';
import { GithubConnectionEntity } from './github-connection.entity';
import { GithubWebhookSourceEntity } from './github-webhook-source.entity';
import { webhookCoverageOf } from './github/webhook-coverage';
import { GithubAuthType } from './enums';
import {
  GithubConnectionInvalidError,
  GithubConnectionNotFoundError,
  IntegrationsDomainError,
} from './errors/integrations.errors';
import {
  GithubAccessToken,
  GithubCredentialSource,
  GithubCredentialsService,
} from './github/github-credentials.service';
import { GithubRepoRef, parseGithubRepoUrl } from './github/github-repo-ref';
import { githubHostOf, isGithubCom, normalizeGithubUrl } from './github/github-host';
import {
  CreateGithubConnectionInput,
  AcceptedGithubWebhook,
  GithubConnectionResult,
  GithubWebhookDelivery,
  GithubWebhookSettings,
  GithubWebhookSource,
  ResolvedGithubConnection,
  UpdateGithubConnectionInput,
} from './dto/service/github-connections.service.types';

/** Trims, drops blanks and duplicates (ignoring case), keeps the first spelling. */
function normalizeOwners(owners: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of owners ?? []) {
    const owner = raw.trim().replace(/^@/, '');
    if (!owner || seen.has(owner.toLowerCase())) continue;
    seen.add(owner.toLowerCase());
    result.push(owner);
  }
  return result;
}

function normalizeBaseUrl(value: string | null | undefined): string {
  const baseUrl = normalizeGithubUrl(value);
  if (!baseUrl) {
    throw new GithubConnectionInvalidError(
      'The GitHub address is not valid. Enter the address you open GitHub at, such as https://github.acme.com.',
    );
  }
  return baseUrl;
}

/**
 * How long after its last delivery a webhook is counted on. Repositories go
 * quiet for days, so this is generous; polling stays on as a slow safety net,
 * and a webhook that stops working only costs freshness until this runs out.
 */
export const WEBHOOK_COVERAGE_MS = 24 * 60 * 60 * 1000;

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value?.trim() || null;
}

@Injectable()
export class GithubConnectionsService {
  private readonly logger = new Logger(GithubConnectionsService.name);

  constructor(
    @InjectRepository(GithubConnectionEntity)
    private readonly repository: Repository<GithubConnectionEntity>,
    @InjectRepository(GithubWebhookSourceEntity)
    private readonly webhookSources: Repository<GithubWebhookSourceEntity>,
    private readonly secretsService: SecretsService,
    private readonly credentials: GithubCredentialsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Checks the credential with GitHub first: a connection that does not work is never saved. */
  async createConnection(workspaceId: string, input: CreateGithubConnectionInput): Promise<GithubConnectionResult> {
    const secretValue = input.secret.trim();
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const appId = normalizeOptionalText(input.appId) ?? null;
    const installationId = normalizeOptionalText(input.installationId) ?? null;
    if (!secretValue) {
      throw new GithubConnectionInvalidError(
        input.authType === GithubAuthType.PAT ? 'A token is required.' : 'A private key is required.',
      );
    }

    const accountLogin = await this.credentials.identify({
      authType: input.authType,
      baseUrl,
      secret: secretValue,
      appId,
      installationId,
    });

    const owners = normalizeOwners(input.owners);
    const secret = await this.secretsService.createSecret(workspaceId, {
      // Secret names are unique; the timestamp keeps two connections with one name apart.
      name: `GitHub connection: ${input.name.trim()} (${Date.now()})`,
      description: `${input.authType === GithubAuthType.PAT ? 'Token' : 'GitHub App private key'} for the GitHub connection "${input.name.trim()}"`,
      value: secretValue,
      createdByActorId: input.createdByActorId,
    });
    let saved: GithubConnectionEntity;
    try {
      saved = await this.repository.save(
        this.repository.create({
          workspaceId,
          name: input.name.trim(),
          baseUrl,
          authType: input.authType,
          secretId: secret.id,
          appId: input.authType === GithubAuthType.APP ? appId : null,
          installationId: input.authType === GithubAuthType.APP ? installationId : null,
          owners: owners.length > 0 ? owners : [accountLogin],
          accountLogin,
          lastVerifiedAt: new Date(),
          lastError: null,
        }),
      );
    } catch (error) {
      await this.secretsService.deleteSecret(workspaceId, secret.id);
      throw error;
    }

    this.logger.log({ message: 'GitHub connection created', connectionId: saved.id, authType: saved.authType });
    return this.mapToResult(saved);
  }

  async listConnections(workspaceId: string): Promise<GithubConnectionResult[]> {
    const connections = await this.repository.find({ where: { workspaceId }, order: { createdAt: 'ASC' } });
    return connections.map((connection) => this.mapToResult(connection));
  }

  async getConnection(workspaceId: string, id: string): Promise<GithubConnectionResult> {
    return this.mapToResult(await this.findEntity(workspaceId, id));
  }

  async updateConnection(
    workspaceId: string,
    id: string,
    input: UpdateGithubConnectionInput,
  ): Promise<GithubConnectionResult> {
    const connection = await this.findEntity(workspaceId, id);

    if (input.name !== undefined) connection.name = input.name.trim();
    if (input.owners !== undefined) connection.owners = normalizeOwners(input.owners);

    const appId = normalizeOptionalText(input.appId);
    const installationId = normalizeOptionalText(input.installationId);
    const newSecret = input.secret?.trim() || undefined;
    const baseUrl = input.baseUrl === undefined ? undefined : normalizeBaseUrl(input.baseUrl);
    const credentialChanged =
      newSecret !== undefined ||
      (baseUrl !== undefined && baseUrl !== connection.baseUrl) ||
      (connection.authType === GithubAuthType.APP && (appId !== undefined || installationId !== undefined));

    if (credentialChanged) {
      if (baseUrl !== undefined) connection.baseUrl = baseUrl;
      if (connection.authType === GithubAuthType.APP) {
        if (appId !== undefined) connection.appId = appId;
        if (installationId !== undefined) connection.installationId = installationId;
      }
      const secretValue = newSecret ?? (await this.secretsService.getSecretValue(workspaceId, connection.secretId)).value;
      connection.accountLogin = await this.credentials.identify({
        authType: connection.authType,
        baseUrl: connection.baseUrl,
        secret: secretValue,
        appId: connection.appId,
        installationId: connection.installationId,
      });
      connection.lastVerifiedAt = new Date();
      connection.lastError = null;
      if (newSecret !== undefined) {
        await this.secretsService.updateSecret(workspaceId, connection.secretId, { value: newSecret });
      }
      this.credentials.forget(connection.id);
    }

    // As on creation: no owners means the account the credential acts as.
    if (connection.owners.length === 0 && connection.accountLogin) {
      connection.owners = [connection.accountLogin];
    }

    const saved = await this.repository.save(connection);
    return this.mapToResult(saved);
  }

  /** Projects using the connection fall back to automatic matching (the foreign key sets them to null). */
  async deleteConnection(workspaceId: string, id: string): Promise<void> {
    const connection = await this.findEntity(workspaceId, id);
    await this.repository.delete({ workspaceId, id });
    await this.secretsService.deleteSecret(workspaceId, connection.secretId);
    if (connection.webhookSecretId) await this.secretsService.deleteSecret(workspaceId, connection.webhookSecretId);
    this.credentials.forget(id);
    this.logger.log({ message: 'GitHub connection deleted', connectionId: id });
  }

  /** Checks the stored credential again and records the outcome. Never throws for a rejected credential. */
  async verifyConnection(workspaceId: string, id: string): Promise<GithubConnectionResult> {
    const connection = await this.findEntity(workspaceId, id);
    try {
      const secret = await this.secretsService.getSecretValue(workspaceId, connection.secretId);
      connection.accountLogin = await this.credentials.identify({
        authType: connection.authType,
        baseUrl: connection.baseUrl,
        secret: secret.value,
        appId: connection.appId,
        installationId: connection.installationId,
      });
      connection.lastError = null;
    } catch (error) {
      if (!(error instanceof IntegrationsDomainError)) throw error;
      connection.lastError = error.message;
    }
    connection.lastVerifiedAt = new Date();
    this.credentials.forget(connection.id);
    return this.mapToResult(await this.repository.save(connection));
  }

  /**
   * Which connection serves a repository: the one its project names, else the
   * one listing its owner, else the only connection there is. Only connections
   * to the repository's own GitHub (github.com or an Enterprise host) count.
   * Null when none fits; Taico then reads public github.com repositories
   * anonymously. Only the workspace's own connections count.
   */
  async resolveForRepository(workspaceId: string, input: {
    host: string;
    owner: string;
    projectConnectionId?: string | null;
  }): Promise<ResolvedGithubConnection | null> {
    const host = input.host.toLowerCase();
    const onHost = (connection: GithubConnectionEntity) => githubHostOf(connection.baseUrl) === host;

    if (input.projectConnectionId) {
      const named = await this.repository.findOne({ where: { workspaceId, id: input.projectConnectionId } });
      if (named && onHost(named)) return { connection: this.mapToResult(named), match: 'project' };
    }

    const connections = (await this.repository.find({ where: { workspaceId }, order: { createdAt: 'ASC' } })).filter(onHost);
    const owner = input.owner.toLowerCase();
    const byOwner = connections.find((connection) =>
      connection.owners.some((candidate) => candidate.toLowerCase() === owner),
    );
    if (byOwner) return { connection: this.mapToResult(byOwner), match: 'owner' };
    if (connections.length === 1) return { connection: this.mapToResult(connections[0]), match: 'only_connection' };
    return null;
  }

  /**
   * Like resolveForRepository, but for a repository Taico meets outside a
   * project (a pull request link): the first project of the workspace whose
   * repository it is decides, if that project names a connection.
   */
  async resolveForRepositoryOfAnyProject(
    workspaceId: string,
    input: GithubRepoRef,
  ): Promise<ResolvedGithubConnection | null> {
    const projects: Array<{ repo_url: string; github_connection_id: string }> = await this.dataSource.query(
      `SELECT "repoUrl" AS repo_url, github_connection_id FROM projects
        WHERE workspace_id = $1 AND github_connection_id IS NOT NULL AND "repoUrl" IS NOT NULL AND deleted_at IS NULL
        ORDER BY created_at ASC`,
      [workspaceId],
    );
    const hosts = await this.listEnterpriseHosts(workspaceId);
    const host = input.host.toLowerCase();
    const owner = input.owner.toLowerCase();
    const repo = input.repo.toLowerCase();
    const project = projects.find((row) => {
      const ref = parseGithubRepoUrl(row.repo_url, hosts);
      return ref?.host === host && ref.owner.toLowerCase() === owner && ref.repo.toLowerCase() === repo;
    });
    return this.resolveForRepository(workspaceId, {
      host: input.host,
      owner: input.owner,
      projectConnectionId: project?.github_connection_id,
    });
  }

  /**
   * Hosts of the GitHub Enterprises the workspace has connections to
   * (github.com is always known). Links and repositories on other hosts are
   * not GitHub's, for this workspace.
   */
  async listEnterpriseHosts(workspaceId: string): Promise<string[]> {
    const rows: Array<{ base_url: string }> = await this.dataSource.query(
      `SELECT DISTINCT base_url FROM github_connections WHERE workspace_id = $1`,
      [workspaceId],
    );
    return [...new Set(rows.map((row) => githubHostOf(row.base_url)))].filter((host) => !isGithubCom(host));
  }

  /** Reads a repository URL, knowing the Enterprise hosts the workspace has connections to. */
  async parseRepoUrl(workspaceId: string, url: string | null | undefined): Promise<GithubRepoRef | null> {
    return parseGithubRepoUrl(url, await this.listEnterpriseHosts(workspaceId));
  }

  /** Webhook address and secret for this connection; the secret is created on first use. */
  async getWebhookSettings(
    workspaceId: string,
    id: string,
    createdByActorId: string,
  ): Promise<GithubWebhookSettings> {
    const connection = await this.findEntity(workspaceId, id);
    let secret: string;
    if (connection.webhookSecretId) {
      secret = (await this.secretsService.getSecretValue(workspaceId, connection.webhookSecretId)).value;
    } else {
      secret = randomBytes(32).toString('hex');
      const stored = await this.secretsService.createSecret(workspaceId, {
        name: `GitHub connection webhook: ${connection.name} (${Date.now()})`,
        description: `Webhook secret for the GitHub connection "${connection.name}"`,
        value: secret,
        createdByActorId,
      });
      connection.webhookSecretId = stored.id;
      await this.repository.save(connection);
    }
    return {
      url: `${getConfig().issuerUrl.replace(/\/+$/, '')}/api/v1/integrations/github/webhooks/${connection.id}`,
      secret,
      lastDeliveryAt: connection.lastWebhookAt,
      sources: await this.listWebhookSources(workspaceId, connection.id),
    };
  }

  /** Repositories and owners this connection received webhooks for, most recent first. */
  async listWebhookSources(workspaceId: string, connectionId: string): Promise<GithubWebhookSource[]> {
    const rows = await this.webhookSources.find({
      where: { workspaceId, connectionId },
      order: { lastDeliveryAt: 'DESC' },
    });
    return rows.map((row) => this.mapWebhookSource(row));
  }

  /**
   * The most recent webhook that covers a repository, through any of the
   * workspace's connections to the repository's GitHub (github.com or an
   * Enterprise host): one set up on the repository itself, or on its whole
   * owner. Null when GitHub never sent one.
   */
  async findWebhookCoverage(
    workspaceId: string,
    ref: { host: string; owner: string; repo: string },
  ): Promise<GithubWebhookSource | null> {
    const rows = await this.webhookSources
      .createQueryBuilder('source')
      .innerJoinAndSelect('source.connection', 'connection')
      .where('source.workspaceId = :workspaceId', { workspaceId })
      .andWhere('connection.workspaceId = :workspaceId', { workspaceId })
      .andWhere('source.ownerKey = :owner', { owner: ref.owner.toLowerCase() })
      .andWhere(`source.repoKey IN (:repo, '')`, { repo: ref.repo.toLowerCase() })
      .orderBy('source.lastDeliveryAt', 'DESC')
      .getMany();
    const host = ref.host.toLowerCase();
    const row = rows.find((candidate) => githubHostOf(candidate.connection!.baseUrl) === host);
    return row ? this.mapWebhookSource(row) : null;
  }

  /** Whether a recent webhook covers the repository, so polling can slow down. */
  async hasActiveWebhook(workspaceId: string, ref: { host: string; owner: string; repo: string }): Promise<boolean> {
    return (await this.findWebhookCoverage(workspaceId, ref))?.active ?? false;
  }

  /**
   * Checks GitHub's `X-Hub-Signature-256` over the exact bytes received, and
   * records the delivery when it matches: when it arrived, and which
   * repository (or whole owner) the webhook covers. Null for an unknown
   * connection, a connection without webhook secret, or a bad signature.
   *
   * The webhook URL names only the connection, so this is the one lookup by
   * id alone: the signature proves the delivery is for that connection, and
   * everything the delivery does then happens in the connection's workspace.
   */
  async acceptWebhookDelivery(
    id: string,
    delivery: GithubWebhookDelivery,
  ): Promise<AcceptedGithubWebhook | null> {
    const connection = await this.repository.findOne({ where: { id } });
    if (!connection?.webhookSecretId || !delivery.signature?.startsWith('sha256=')) return null;
    const secret = (await this.secretsService.getSecretValue(connection.workspaceId, connection.webhookSecretId))
      .value;
    const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(delivery.rawBody).digest('hex')}`);
    const received = Buffer.from(delivery.signature);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

    const now = new Date();
    await this.repository.update({ id }, { lastWebhookAt: now });

    // A GitHub App's ping names no account: the installation's is the one the connection acts as.
    const coverage =
      webhookCoverageOf(delivery.targetType, delivery.body) ??
      (delivery.targetType === 'integration' && connection.authType === GithubAuthType.APP && connection.accountLogin
        ? { owner: connection.accountLogin, repo: null }
        : null);
    if (coverage) {
      await this.webhookSources
        .createQueryBuilder()
        .insert()
        .into(GithubWebhookSourceEntity)
        .values({
          workspaceId: connection.workspaceId,
          connectionId: id,
          owner: coverage.owner,
          repo: coverage.repo,
          ownerKey: coverage.owner.toLowerCase(),
          repoKey: coverage.repo?.toLowerCase() ?? '',
          lastDeliveryAt: now,
          lastEvent: delivery.event ?? null,
        })
        .orUpdate(['owner', 'repo', 'last_delivery_at', 'last_event'], ['connection_id', 'owner_key', 'repo_key'])
        .execute();
    }
    return { workspaceId: connection.workspaceId, host: githubHostOf(connection.baseUrl) };
  }

  /** What it takes to mint tokens for this connection (never the credential itself). */
  async getCredentialSource(workspaceId: string, id: string): Promise<GithubCredentialSource> {
    const connection = await this.findEntity(workspaceId, id);
    return {
      id: connection.id,
      workspaceId: connection.workspaceId,
      authType: connection.authType,
      baseUrl: connection.baseUrl,
      secretId: connection.secretId,
      appId: connection.appId,
      installationId: connection.installationId,
    };
  }

  /** A token for Taico's own calls to GitHub through this connection. */
  async getAccessToken(workspaceId: string, id: string): Promise<GithubAccessToken> {
    return this.credentials.getAccessToken(await this.findEntity(workspaceId, id));
  }

  /** A connection of another workspace is not found. */
  private async findEntity(workspaceId: string, id: string): Promise<GithubConnectionEntity> {
    const connection = await this.repository.findOne({ where: { workspaceId, id } });
    if (!connection) throw new GithubConnectionNotFoundError(id);
    return connection;
  }

  private mapWebhookSource(row: GithubWebhookSourceEntity): GithubWebhookSource {
    return {
      owner: row.owner,
      repo: row.repo,
      lastDeliveryAt: row.lastDeliveryAt,
      lastEvent: row.lastEvent,
      active: Date.now() - row.lastDeliveryAt.getTime() < WEBHOOK_COVERAGE_MS,
    };
  }

  private mapToResult(connection: GithubConnectionEntity): GithubConnectionResult {
    return {
      id: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl,
      host: githubHostOf(connection.baseUrl),
      authType: connection.authType,
      appId: connection.appId,
      installationId: connection.installationId,
      owners: connection.owners,
      accountLogin: connection.accountLogin,
      lastVerifiedAt: connection.lastVerifiedAt,
      lastError: connection.lastError,
      lastWebhookAt: connection.lastWebhookAt,
      rowVersion: connection.rowVersion,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }
}
