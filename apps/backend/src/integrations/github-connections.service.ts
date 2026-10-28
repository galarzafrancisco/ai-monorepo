import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecretsService } from '../secrets/secrets.service';
import { GithubConnectionEntity } from './github-connection.entity';
import { GithubAuthType } from './enums';
import {
  GithubConnectionInvalidError,
  GithubConnectionNotFoundError,
  IntegrationsDomainError,
} from './errors/integrations.errors';
import { GithubAccessToken, GithubCredentialsService } from './github/github-credentials.service';
import {
  CreateGithubConnectionInput,
  GithubConnectionResult,
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
    private readonly secretsService: SecretsService,
    private readonly credentials: GithubCredentialsService,
  ) {}

  /** Checks the credential with GitHub first: a connection that does not work is never saved. */
  async createConnection(input: CreateGithubConnectionInput): Promise<GithubConnectionResult> {
    const secretValue = input.secret.trim();
    const appId = normalizeOptionalText(input.appId) ?? null;
    const installationId = normalizeOptionalText(input.installationId) ?? null;
    if (!secretValue) {
      throw new GithubConnectionInvalidError(
        input.authType === GithubAuthType.PAT ? 'A token is required.' : 'A private key is required.',
      );
    }

    const accountLogin = await this.credentials.identify({
      authType: input.authType,
      secret: secretValue,
      appId,
      installationId,
    });

    const owners = normalizeOwners(input.owners);
    const secret = await this.secretsService.createSecret({
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
          name: input.name.trim(),
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
      await this.secretsService.deleteSecret(secret.id);
      throw error;
    }

    this.logger.log({ message: 'GitHub connection created', connectionId: saved.id, authType: saved.authType });
    return this.mapToResult(saved);
  }

  async listConnections(): Promise<GithubConnectionResult[]> {
    const connections = await this.repository.find({ order: { createdAt: 'ASC' } });
    return connections.map((connection) => this.mapToResult(connection));
  }

  async getConnection(id: string): Promise<GithubConnectionResult> {
    return this.mapToResult(await this.findEntity(id));
  }

  async updateConnection(id: string, input: UpdateGithubConnectionInput): Promise<GithubConnectionResult> {
    const connection = await this.findEntity(id);

    if (input.name !== undefined) connection.name = input.name.trim();
    if (input.owners !== undefined) connection.owners = normalizeOwners(input.owners);

    const appId = normalizeOptionalText(input.appId);
    const installationId = normalizeOptionalText(input.installationId);
    const newSecret = input.secret?.trim() || undefined;
    const credentialChanged =
      newSecret !== undefined ||
      (connection.authType === GithubAuthType.APP && (appId !== undefined || installationId !== undefined));

    if (credentialChanged) {
      if (connection.authType === GithubAuthType.APP) {
        if (appId !== undefined) connection.appId = appId;
        if (installationId !== undefined) connection.installationId = installationId;
      }
      const secretValue = newSecret ?? (await this.secretsService.getSecretValue(connection.secretId)).value;
      connection.accountLogin = await this.credentials.identify({
        authType: connection.authType,
        secret: secretValue,
        appId: connection.appId,
        installationId: connection.installationId,
      });
      connection.lastVerifiedAt = new Date();
      connection.lastError = null;
      if (newSecret !== undefined) {
        await this.secretsService.updateSecret(connection.secretId, { value: newSecret });
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
  async deleteConnection(id: string): Promise<void> {
    const connection = await this.findEntity(id);
    await this.repository.delete(id);
    await this.secretsService.deleteSecret(connection.secretId);
    this.credentials.forget(id);
    this.logger.log({ message: 'GitHub connection deleted', connectionId: id });
  }

  /** Checks the stored credential again and records the outcome. Never throws for a rejected credential. */
  async verifyConnection(id: string): Promise<GithubConnectionResult> {
    const connection = await this.findEntity(id);
    try {
      const secret = await this.secretsService.getSecretValue(connection.secretId);
      connection.accountLogin = await this.credentials.identify({
        authType: connection.authType,
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
   * one listing its owner, else the only connection there is. Null when none
   * fits; Taico then reads public repositories anonymously.
   */
  async resolveForRepository(input: {
    owner: string;
    projectConnectionId?: string | null;
  }): Promise<ResolvedGithubConnection | null> {
    if (input.projectConnectionId) {
      const named = await this.repository.findOne({ where: { id: input.projectConnectionId } });
      if (named) return { connection: this.mapToResult(named), match: 'project' };
    }

    const connections = await this.repository.find({ order: { createdAt: 'ASC' } });
    const owner = input.owner.toLowerCase();
    const byOwner = connections.find((connection) =>
      connection.owners.some((candidate) => candidate.toLowerCase() === owner),
    );
    if (byOwner) return { connection: this.mapToResult(byOwner), match: 'owner' };
    if (connections.length === 1) return { connection: this.mapToResult(connections[0]), match: 'only_connection' };
    return null;
  }

  /** A token for Taico's own calls to GitHub through this connection. */
  async getAccessToken(id: string): Promise<GithubAccessToken> {
    return this.credentials.getAccessToken(await this.findEntity(id));
  }

  private async findEntity(id: string): Promise<GithubConnectionEntity> {
    const connection = await this.repository.findOne({ where: { id } });
    if (!connection) throw new GithubConnectionNotFoundError(id);
    return connection;
  }

  private mapToResult(connection: GithubConnectionEntity): GithubConnectionResult {
    return {
      id: connection.id,
      name: connection.name,
      authType: connection.authType,
      appId: connection.appId,
      installationId: connection.installationId,
      owners: connection.owners,
      accountLogin: connection.accountLogin,
      lastVerifiedAt: connection.lastVerifiedAt,
      lastError: connection.lastError,
      rowVersion: connection.rowVersion,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
    };
  }
}
