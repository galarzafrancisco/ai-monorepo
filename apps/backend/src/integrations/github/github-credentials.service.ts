import { Injectable, Logger } from '@nestjs/common';
import { SecretsService } from '../../secrets/secrets.service';
import { GithubAuthType } from '../enums';
import { GithubConnectionInvalidError, GithubRequestFailedError } from '../errors/integrations.errors';
import { createAppJwt, githubRequest } from './github-api';

/** What a connection needs to authenticate. Mirrors the columns of github_connections. */
export type GithubCredentialSource = {
  id: string;
  authType: GithubAuthType;
  secretId: string;
  appId: string | null;
  installationId: string | null;
};

export type GithubAccessToken = {
  token: string;
  /** Null for a personal access token: GitHub does not say when it expires. */
  expiresAt: Date | null;
};

/** An installation token is renewed when it has less than this long left. */
const INSTALLATION_TOKEN_MARGIN_MS = 5 * 60 * 1000;

/**
 * Turns a connection into a token GitHub accepts, and checks credentials before
 * they are saved. Installation tokens are cached per connection until shortly
 * before they expire.
 */
@Injectable()
export class GithubCredentialsService {
  private readonly logger = new Logger(GithubCredentialsService.name);
  private readonly installationTokens = new Map<string, GithubAccessToken>();

  constructor(private readonly secretsService: SecretsService) {}

  /** A token for Taico's own calls (reading pull requests). */
  async getAccessToken(connection: GithubCredentialSource): Promise<GithubAccessToken> {
    const secret = await this.secretsService.getSecretValue(connection.secretId);
    if (connection.authType === GithubAuthType.PAT) {
      return { token: secret.value, expiresAt: null };
    }

    const cached = this.installationTokens.get(connection.id);
    if (cached?.expiresAt && cached.expiresAt.getTime() - Date.now() > INSTALLATION_TOKEN_MARGIN_MS) {
      return cached;
    }
    const minted = await this.mintInstallationToken(connection, secret.value);
    this.installationTokens.set(connection.id, minted);
    return minted;
  }

  /**
   * A fresh installation token limited to the given repositories (names
   * without the owner). Not cached: each one is handed out once.
   */
  async mintScopedInstallationToken(
    connection: GithubCredentialSource,
    repositories: string[],
  ): Promise<GithubAccessToken> {
    const secret = await this.secretsService.getSecretValue(connection.secretId);
    return this.mintInstallationToken(connection, secret.value, repositories);
  }

  /** Forgets cached tokens, for when a connection's credential changes or it is deleted. */
  forget(connectionId: string): void {
    this.installationTokens.delete(connectionId);
  }

  /**
   * Checks a credential with GitHub and returns the login it acts as. Throws
   * GithubConnectionInvalidError when GitHub rejects it.
   */
  async identify(input: {
    authType: GithubAuthType;
    secret: string;
    appId?: string | null;
    installationId?: string | null;
  }): Promise<string> {
    try {
      if (input.authType === GithubAuthType.PAT) {
        const { data } = await githubRequest<{ login: string }>(input.secret, '/user');
        return data!.login;
      }

      const { appId, installationId } = requireAppSettings(input);
      const jwt = signAppJwt(appId, input.secret);
      const { data } = await githubRequest<{ account: { login: string } | null }>(
        jwt,
        `/app/installations/${encodeURIComponent(installationId)}`,
      );
      return data!.account?.login ?? `installation ${installationId}`;
    } catch (error) {
      if (error instanceof GithubRequestFailedError && error.status !== null && error.status < 500) {
        throw new GithubConnectionInvalidError(`GitHub rejected the credential. ${error.message}.`);
      }
      throw error;
    }
  }

  private async mintInstallationToken(
    connection: GithubCredentialSource,
    privateKey: string,
    repositories?: string[],
  ): Promise<GithubAccessToken> {
    const { appId, installationId } = requireAppSettings(connection);
    const jwt = signAppJwt(appId, privateKey);
    const { data } = await githubRequest<{ token: string; expires_at: string }>(
      jwt,
      `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
      { method: 'POST', body: repositories ? { repositories } : undefined },
    );
    this.logger.log({
      message: 'Minted GitHub installation token',
      connectionId: connection.id,
      scopedToRepositories: repositories ?? null,
    });
    return { token: data!.token, expiresAt: new Date(data!.expires_at) };
  }
}

function requireAppSettings(input: { appId?: string | null; installationId?: string | null }): {
  appId: string;
  installationId: string;
} {
  if (!input.appId || !input.installationId) {
    throw new GithubConnectionInvalidError('A GitHub App connection needs an app id and an installation id.');
  }
  return { appId: input.appId, installationId: input.installationId };
}

function signAppJwt(appId: string, privateKey: string): string {
  try {
    return createAppJwt(appId, privateKey);
  } catch {
    throw new GithubConnectionInvalidError(
      'The private key could not be read. Paste the whole .pem file GitHub gave you, including the BEGIN and END lines.',
    );
  }
}
