import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  LessThan,
  MoreThan,
  Repository,
} from 'typeorm';
import {
  getChatgptSubscriptionCallbackPort,
  isChatgptSubscriptionEnabled,
} from 'src/config/env.config';
import { User } from 'src/identity-provider/user.entity';
import { SecretsEncryptionService } from 'src/secrets/secrets-encryption.service';
import { AiProviderAuthorizationAttemptEntity } from '../ai-provider-authorization-attempt.entity';
import { AiProviderConnectionEntity } from '../ai-provider-connection.entity';
import { AiProviderEntity } from '../ai-provider.entity';
import {
  AiProviderConnectionResult,
  CompleteAiProviderAuthorizationInput,
  DisconnectAiProviderResult,
  OnBehalfOf,
  StartAiProviderAuthorizationResult,
} from '../dto/service/ai-providers.service.types';
import { AiProviderConnectionStatus, AiProviderType } from '../enums';
import {
  AiProviderAuthorizationFailedError,
  AiProviderConnectionConsentRequiredError,
  AiProviderConnectionNotSupportedError,
  AiProviderConnectionRequiredError,
  AiProviderNotFoundError,
  AiProviderRequestFailedError,
  AiProviderTypeDisabledError,
} from '../errors/ai-providers.errors';
import {
  ChatgptOAuthClient,
  ChatgptTokenEndpointError,
  ChatgptTokenSet,
  VerifiedChatgptIdentity,
} from './chatgpt-oauth.client';
import {
  AUTHORIZATION_ATTEMPT_TTL_MS,
  MANAGE_USAGE_URL,
  PLAN_USAGE_SCOPE,
  REDIRECT_HOST,
  REDIRECT_PATH,
  REGISTRATION_CLIENT_ID,
} from './chatgpt-subscription.constants';

/** An access token this close to expiring is refreshed before it is used. */
const REFRESH_SKEW_MS = 60_000;

const NO_FALLBACK = 'No other provider was used.';
const WHERE_TO_CONNECT = 'Settings → AI models';

type StoredCredentials = {
  accessToken: string;
  refreshToken: string;
  idToken: string | null;
};

type RefreshOutcome =
  | { kind: 'token'; accessToken: string }
  | { kind: 'reauthorize' }
  | { kind: 'plan_access_lost' }
  | { kind: 'failed'; error: ChatgptTokenEndpointError | Error };

/** Scheme, host, port and path, normalized the same way as a pasted address. */
function withoutQuery(address: string): string {
  const url = new URL(address);
  return `${url.origin}${url.pathname}`;
}

function hashState(state: string): string {
  return createHash('sha256').update(state).digest('hex');
}

function grantsPlanUsage(scope: string | null): boolean {
  return !!scope && scope.split(/\s+/).includes(PLAN_USAGE_SCOPE);
}

/** Why Sign in with ChatGPT cannot be used on this server, or null when it can. */
export function chatgptSubscriptionUnavailableReason(
  encryption: Pick<SecretsEncryptionService, 'isEncrypting'>,
): string | null {
  if (!isChatgptSubscriptionEnabled()) {
    return (
      'Sign in with ChatGPT is turned off on this server. It is only for a Taico you run ' +
      'yourself: set CHATGPT_SUBSCRIPTION_ENABLED=true if that is the case.'
    );
  }
  if (!encryption.isEncrypting()) {
    return (
      'Sign in with ChatGPT needs encrypted secret storage. Set SECRETS_ENABLED=true and ' +
      'SECRETS_ENCRYPTION_KEY; plaintext mode is not accepted for these tokens.'
    );
  }
  return null;
}

/**
 * Each person's own Sign in with ChatGPT connection: starting and finishing
 * the sign-in, keeping the tokens fresh, and deciding whether a thread turn may
 * run on a person's plan.
 *
 * A connection is only ever used for the Taico user it belongs to. Tokens are
 * stored encrypted and never leave the backend.
 */
@Injectable()
export class ChatgptConnectionsService {
  private readonly logger = new Logger(ChatgptConnectionsService.name);
  /** One refresh per connection at a time in this process; the row lock covers other processes. */
  private readonly refreshing = new Map<string, Promise<string>>();

  constructor(
    @InjectRepository(AiProviderConnectionEntity)
    private readonly connections: Repository<AiProviderConnectionEntity>,
    @InjectRepository(AiProviderAuthorizationAttemptEntity)
    private readonly attempts: Repository<AiProviderAuthorizationAttemptEntity>,
    @InjectRepository(AiProviderEntity)
    private readonly providers: Repository<AiProviderEntity>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly encryption: SecretsEncryptionService,
    private readonly oauth: ChatgptOAuthClient,
  ) {}

  /** Throws when this server may not use Sign in with ChatGPT. */
  assertAvailable(): void {
    const reason = chatgptSubscriptionUnavailableReason(this.encryption);
    if (reason) {
      throw new AiProviderTypeDisabledError(
        AiProviderType.CHATGPT_SUBSCRIPTION,
        reason,
      );
    }
  }

  async getConnection(
    providerId: string,
    actorId: string,
  ): Promise<AiProviderConnectionResult> {
    await this.getProvider(providerId);
    const user = await this.findUser(actorId);
    if (!user) {
      return this.toResult(providerId, null, false);
    }
    return this.describe(providerId, user.id);
  }

  async startAuthorization(
    providerId: string,
    actorId: string,
  ): Promise<StartAiProviderAuthorizationResult> {
    this.assertAvailable();
    const provider = await this.getProvider(providerId);
    const user = await this.requireUser(providerId, actorId);
    const connection = await this.loadWithCredentials(
      this.connections.manager,
      { aiProviderId: providerId, userId: user.id },
    );

    // A disconnected person starts over. Anyone else signs in again with the client they were issued.
    const issuedClientId =
      connection &&
      connection.status !== AiProviderConnectionStatus.DISCONNECTED
        ? connection.externalClientId
        : null;
    const credentials = connection ? this.readCredentials(connection) : null;

    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const codeVerifier = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + AUTHORIZATION_ATTEMPT_TTL_MS);
    // Stored with the attempt, so the code exchange repeats exactly what OpenAI saw.
    const redirectUri = `http://${REDIRECT_HOST}:${getChatgptSubscriptionCallbackPort()}${REDIRECT_PATH}`;

    await this.attempts.delete({ aiProviderId: providerId, userId: user.id });
    await this.attempts.delete({ expiresAt: LessThan(new Date()) });
    await this.attempts.insert({
      aiProviderId: providerId,
      userId: user.id,
      stateHash: hashState(state),
      nonce,
      codeVerifier: this.encryption.encrypt(codeVerifier),
      redirectUri,
      clientId: issuedClientId ?? REGISTRATION_CLIENT_ID,
      isRegistration: !issuedClientId,
      expiresAt,
    });

    const authorizationUrl = this.oauth.buildAuthorizationUrl({
      issuedClientId,
      redirectUri,
      state,
      nonce,
      codeVerifier,
      hostId: await this.ensureHostId(provider),
      idTokenHint: credentials?.idToken,
      loginHint: connection?.externalEmail,
    });

    this.logger.log({
      message: 'Started Sign in with ChatGPT',
      providerId,
      userId: user.id,
      isRegistration: !issuedClientId,
    });

    return { authorizationUrl, expiresAt };
  }

  /**
   * Finishes a sign-in with what OpenAI sent to the redirect. Only the Taico
   * user who started it can finish it, and only once.
   */
  async completeAuthorization(
    providerId: string,
    actorId: string,
    callback: CompleteAiProviderAuthorizationInput,
  ): Promise<AiProviderConnectionResult> {
    this.assertAvailable();
    await this.getProvider(providerId);
    const user = await this.requireUser(providerId, actorId);

    // Deleting is the claim: of two requests with the same state, one gets the row.
    const claimed = await this.attempts
      .createQueryBuilder()
      .delete()
      .where(
        'state_hash = :stateHash AND user_id = :userId AND ai_provider_id = :providerId',
        {
          stateHash: hashState(callback.state),
          userId: user.id,
          providerId,
        },
      )
      .returning('*')
      .execute();

    const row = (claimed.raw as Array<Record<string, unknown>>)[0];
    if (!row || new Date(row.expires_at as string).getTime() < Date.now()) {
      throw new AiProviderAuthorizationFailedError(
        'This sign-in is unknown, was already used, or has expired. Start again.',
      );
    }
    const attempt = {
      nonce: row.nonce as string,
      codeVerifier: this.encryption.decrypt(row.code_verifier as string),
      redirectUri: row.redirect_uri as string,
      clientId: row.client_id as string,
      isRegistration: row.is_registration as boolean,
    };

    // A pasted address must be the redirect this sign-in asked OpenAI for.
    if (
      callback.redirectAddress &&
      callback.redirectAddress !== withoutQuery(attempt.redirectUri)
    ) {
      throw new AiProviderAuthorizationFailedError(
        `That address is not where OpenAI sends this sign-in back to (${attempt.redirectUri}). Start again and paste the address your browser lands on.`,
      );
    }

    if (callback.error) {
      throw new AiProviderAuthorizationFailedError(
        callback.error === 'access_denied'
          ? 'You did not approve the request at OpenAI, so nothing was connected.'
          : `OpenAI did not complete the sign-in (${callback.error}). Nothing was connected.`,
        {
          oauthError: callback.error,
          description: callback.errorDescription ?? null,
        },
      );
    }
    if (!callback.code) {
      throw new AiProviderAuthorizationFailedError(
        'The address OpenAI sent you back to has no authorization code. Start again.',
      );
    }

    let clientId: string;
    if (attempt.isRegistration) {
      if (!callback.clientId || callback.clientId === REGISTRATION_CLIENT_ID) {
        throw new AiProviderAuthorizationFailedError(
          'OpenAI did not issue a client for this installation. Start again.',
        );
      }
      clientId = callback.clientId;
    } else {
      if (callback.clientId && callback.clientId !== attempt.clientId) {
        throw new AiProviderAuthorizationFailedError(
          'OpenAI answered for a different client than the one that was connected. Nothing was changed.',
        );
      }
      clientId = attempt.clientId;
    }

    let tokens: ChatgptTokenSet;
    try {
      tokens = await this.oauth.exchangeCode({
        clientId,
        code: callback.code,
        codeVerifier: attempt.codeVerifier,
        redirectUri: attempt.redirectUri,
      });
    } catch (error) {
      throw new AiProviderAuthorizationFailedError(
        'OpenAI rejected the sign-in when Taico tried to finish it. Start again.',
        { reason: error instanceof Error ? error.message : String(error) },
      );
    }

    if (!tokens.idToken) {
      await this.oauth.revoke({ clientId, refreshToken: tokens.refreshToken });
      throw new AiProviderAuthorizationFailedError(
        'OpenAI did not say which account signed in. Nothing was connected.',
      );
    }

    let identity: VerifiedChatgptIdentity;
    try {
      identity = await this.oauth.verifyIdToken({
        idToken: tokens.idToken,
        clientId,
        nonce: attempt.nonce,
      });
    } catch (error) {
      await this.oauth.revoke({ clientId, refreshToken: tokens.refreshToken });
      throw error;
    }

    const existing = await this.connections.findOne({
      where: { aiProviderId: providerId, userId: user.id },
    });
    if (
      !attempt.isRegistration &&
      existing?.externalSubject &&
      (existing.externalSubject !== identity.subject ||
        existing.externalIssuer !== identity.issuer)
    ) {
      await this.oauth.revoke({ clientId, refreshToken: tokens.refreshToken });
      throw new AiProviderAuthorizationFailedError(
        'You signed in with a different ChatGPT account than the one that was connected. ' +
          'Disconnect first to switch accounts.',
      );
    }

    const canUsePlan = grantsPlanUsage(tokens.scope);
    const connection =
      existing ??
      this.connections.create({ aiProviderId: providerId, userId: user.id });
    connection.status = canUsePlan
      ? AiProviderConnectionStatus.CONNECTED
      : AiProviderConnectionStatus.PLAN_ACCESS_NOT_GRANTED;
    connection.externalClientId = clientId;
    connection.externalIssuer = identity.issuer;
    connection.externalSubject = identity.subject;
    connection.externalEmail = identity.email;
    connection.grantedScopes = tokens.scope;
    connection.credentials = this.writeCredentials({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
    });
    connection.accessTokenExpiresAt = new Date(
      Date.now() + tokens.expiresInSeconds * 1000,
    );
    connection.automatedTurnsAllowedAt =
      existing?.automatedTurnsAllowedAt ?? null;
    connection.lastErrorCode = null;
    connection.lastErrorAt = null;
    await this.connections.save(connection);

    this.logger.log({
      message: 'Connected a ChatGPT account',
      providerId,
      userId: user.id,
      canUsePlan,
    });

    return this.describe(providerId, user.id);
  }

  async setAutomatedTurnsAllowed(
    providerId: string,
    actorId: string,
    allowed: boolean,
  ): Promise<AiProviderConnectionResult> {
    await this.getProvider(providerId);
    const user = await this.requireUser(providerId, actorId);
    const connection = await this.connections.findOne({
      where: { aiProviderId: providerId, userId: user.id },
    });
    if (connection?.status !== AiProviderConnectionStatus.CONNECTED) {
      throw new AiProviderConnectionRequiredError(
        providerId,
        'Connect your ChatGPT account before changing this.',
      );
    }

    if (allowed !== !!connection.automatedTurnsAllowedAt) {
      connection.automatedTurnsAllowedAt = allowed ? new Date() : null;
      await this.connections.save(connection);
    }
    return this.describe(providerId, user.id);
  }

  /** Revokes the grant at OpenAI and removes everything stored about the account. */
  async disconnect(
    providerId: string,
    actorId: string,
  ): Promise<DisconnectAiProviderResult> {
    await this.getProvider(providerId);
    const user = await this.requireUser(providerId, actorId);
    await this.attempts.delete({ aiProviderId: providerId, userId: user.id });

    const connection = await this.loadWithCredentials(
      this.connections.manager,
      {
        aiProviderId: providerId,
        userId: user.id,
      },
    );
    if (!connection) {
      return { revokedAtProvider: true };
    }

    const revokedAtProvider = await this.clear(connection);
    this.logger.log({
      message: 'Disconnected a ChatGPT account',
      providerId,
      userId: user.id,
      revokedAtProvider,
    });
    return { revokedAtProvider };
  }

  /** Disconnects everyone. Called before the provider itself is deleted. */
  async disconnectAll(providerId: string): Promise<void> {
    const rows = await this.connections.find({
      where: { aiProviderId: providerId },
    });
    for (const row of rows) {
      const connection = await this.loadWithCredentials(
        this.connections.manager,
        { id: row.id },
      );
      if (connection) {
        await this.clear(connection);
      }
    }
    await this.attempts.delete({ aiProviderId: providerId });
  }

  /**
   * Decides whether a thread turn may run on a person's plan, and returns the
   * connection to use. Only that person's own connection is considered. When
   * it cannot be used the turn fails; it is never answered by someone else's
   * plan or by another provider.
   */
  async authorizeTurn(
    providerId: string,
    onBehalfOf: OnBehalfOf,
  ): Promise<{ connectionId: string }> {
    this.assertAvailable();
    const whose =
      onBehalfOf.description ??
      (onBehalfOf.automated
        ? 'the person this task update is for'
        : 'the person who wrote the message');

    const user = await this.findUser(onBehalfOf.actorId);
    const connection = user
      ? await this.connections.findOne({
          where: { aiProviderId: providerId, userId: user.id },
        })
      : null;

    const status =
      connection?.status ?? AiProviderConnectionStatus.DISCONNECTED;
    if (!connection || status !== AiProviderConnectionStatus.CONNECTED) {
      const problem = {
        [AiProviderConnectionStatus.DISCONNECTED]:
          'has not connected a ChatGPT account',
        [AiProviderConnectionStatus.NEEDS_REAUTHORIZATION]:
          'has to sign in to ChatGPT again, because the connection expired or was removed',
        [AiProviderConnectionStatus.PLAN_ACCESS_NOT_GRANTED]:
          'connected a ChatGPT account without allowing use of its plan',
        [AiProviderConnectionStatus.CONNECTED]: '',
      }[status];
      throw new AiProviderConnectionRequiredError(
        providerId,
        `This thread answers with the ChatGPT plan of ${whose}, who ${problem}. ` +
          `Connect it in ${WHERE_TO_CONNECT}. ${NO_FALLBACK}`,
        { status, automated: onBehalfOf.automated },
      );
    }

    if (onBehalfOf.automated && !connection.automatedTurnsAllowedAt) {
      throw new AiProviderConnectionConsentRequiredError(
        providerId,
        'A task update arrived, but answering it would use a ChatGPT plan without anyone ' +
          `asking, and ${whose} has not allowed that (${WHERE_TO_CONNECT}). ${NO_FALLBACK}`,
      );
    }

    return { connectionId: connection.id };
  }

  /** The connection a person can use right now, for calls they make themselves. */
  async requireOwnConnection(
    providerId: string,
    actorId: string,
  ): Promise<{ connectionId: string }> {
    return this.authorizeTurn(providerId, { actorId, automated: false });
  }

  /** A valid access token for the connection, refreshed first when it is about to expire. */
  async getAccessToken(connectionId: string): Promise<string> {
    const connection = await this.loadWithCredentials(
      this.connections.manager,
      {
        id: connectionId,
      },
    );
    const usable = connection ? this.usableAccessToken(connection) : null;
    if (usable) {
      return usable;
    }
    if (
      !connection ||
      connection.status !== AiProviderConnectionStatus.CONNECTED
    ) {
      throw this.signInAgainError(connection?.aiProviderId ?? null);
    }

    let pending = this.refreshing.get(connectionId);
    if (!pending) {
      pending = this.refresh(connectionId).finally(() =>
        this.refreshing.delete(connectionId),
      );
      this.refreshing.set(connectionId, pending);
    }
    return pending;
  }

  /** Remembers the last failure so settings can show it; a success clears it. */
  async recordOutcome(
    connectionId: string,
    upstreamCode: string | null,
  ): Promise<void> {
    try {
      if (upstreamCode) {
        await this.connections.update(connectionId, {
          lastErrorCode: upstreamCode,
          lastErrorAt: new Date(),
        });
      } else {
        await this.connections
          .createQueryBuilder()
          .update()
          .set({ lastErrorCode: null, lastErrorAt: null })
          .where('id = :id AND last_error_code IS NOT NULL', {
            id: connectionId,
          })
          .execute();
      }
    } catch (error) {
      this.logger.warn({
        message: 'Could not record the outcome of a ChatGPT plan request',
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Rotates the tokens. The row stays locked for the whole exchange, so two
   * processes cannot both spend the same refresh token, and the new access
   * token, refresh token, expiry and scopes are stored together.
   */
  private async refresh(connectionId: string): Promise<string> {
    let providerId: string | null = null;

    const outcome = await this.dataSource.transaction(
      async (manager): Promise<RefreshOutcome> => {
        const connection = await this.loadWithCredentials(
          manager,
          { id: connectionId },
          true,
        );
        providerId = connection?.aiProviderId ?? null;
        if (
          !connection ||
          connection.status !== AiProviderConnectionStatus.CONNECTED
        ) {
          return { kind: 'reauthorize' };
        }

        // Another process may have refreshed while this one waited for the lock.
        const fresh = this.usableAccessToken(connection);
        if (fresh) {
          return { kind: 'token', accessToken: fresh };
        }

        const credentials = this.readCredentials(connection);
        if (!credentials || !connection.externalClientId) {
          await this.markNeedsReauthorization(manager, connection);
          return { kind: 'reauthorize' };
        }

        let tokens: ChatgptTokenSet;
        try {
          tokens = await this.oauth.refresh({
            clientId: connection.externalClientId,
            refreshToken: credentials.refreshToken,
          });
        } catch (error) {
          if (error instanceof ChatgptTokenEndpointError && error.isTerminal) {
            await this.markNeedsReauthorization(manager, connection);
            return { kind: 'reauthorize' };
          }
          return {
            kind: 'failed',
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }

        const scope = tokens.scope ?? connection.grantedScopes;
        const canUsePlan = grantsPlanUsage(scope);
        connection.credentials = this.writeCredentials({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          idToken: tokens.idToken ?? credentials.idToken,
        });
        connection.accessTokenExpiresAt = new Date(
          Date.now() + tokens.expiresInSeconds * 1000,
        );
        connection.grantedScopes = scope;
        if (!canUsePlan) {
          connection.status =
            AiProviderConnectionStatus.PLAN_ACCESS_NOT_GRANTED;
        }
        await manager.save(connection);

        return canUsePlan
          ? { kind: 'token', accessToken: tokens.accessToken }
          : { kind: 'plan_access_lost' };
      },
    );

    switch (outcome.kind) {
      case 'token':
        return outcome.accessToken;
      case 'reauthorize':
        throw this.signInAgainError(providerId);
      case 'plan_access_lost':
        throw new AiProviderConnectionRequiredError(
          providerId ?? '',
          `The connected ChatGPT account no longer allows use of its plan. Connect it again in ${WHERE_TO_CONNECT}. ${NO_FALLBACK}`,
          { status: AiProviderConnectionStatus.PLAN_ACCESS_NOT_GRANTED },
        );
      case 'failed': {
        const oauthError =
          outcome.error instanceof ChatgptTokenEndpointError
            ? outcome.error.oauthError
            : null;
        this.logger.warn({
          message: 'Refreshing a ChatGPT connection failed',
          connectionId,
          oauthError,
          error: outcome.error.message,
        });
        throw new AiProviderRequestFailedError(
          oauthError === 'invalid_client'
            ? `OpenAI no longer accepts this installation's client. Disconnect and connect again in ${WHERE_TO_CONNECT}. ${NO_FALLBACK}`
            : `Could not renew the ChatGPT sign-in right now. The connection was kept; try again shortly. ${NO_FALLBACK}`,
          { upstreamCode: oauthError ?? 'refresh_unavailable' },
        );
      }
    }
  }

  private signInAgainError(
    providerId: string | null,
  ): AiProviderConnectionRequiredError {
    return new AiProviderConnectionRequiredError(
      providerId ?? '',
      `The ChatGPT sign-in expired or was removed. Sign in again in ${WHERE_TO_CONNECT}. ${NO_FALLBACK}`,
      { status: AiProviderConnectionStatus.NEEDS_REAUTHORIZATION },
    );
  }

  /** Clears the tokens but keeps the issued client and the account, which a new sign-in reuses. */
  private async markNeedsReauthorization(
    manager: EntityManager,
    connection: AiProviderConnectionEntity,
  ): Promise<void> {
    connection.status = AiProviderConnectionStatus.NEEDS_REAUTHORIZATION;
    connection.credentials = null;
    connection.accessTokenExpiresAt = null;
    await manager.save(connection);
  }

  /** Returns whether OpenAI confirmed the revocation. The local data is removed either way. */
  private async clear(
    connection: AiProviderConnectionEntity,
  ): Promise<boolean> {
    let revoked = true;
    const credentials = this.readCredentials(connection);
    if (credentials && connection.externalClientId) {
      revoked = await this.oauth.revoke({
        clientId: connection.externalClientId,
        refreshToken: credentials.refreshToken,
      });
    }

    connection.status = AiProviderConnectionStatus.DISCONNECTED;
    connection.credentials = null;
    connection.accessTokenExpiresAt = null;
    connection.externalClientId = null;
    connection.externalIssuer = null;
    connection.externalSubject = null;
    connection.externalEmail = null;
    connection.grantedScopes = null;
    connection.automatedTurnsAllowedAt = null;
    connection.lastErrorCode = null;
    connection.lastErrorAt = null;
    await this.connections.save(connection);
    return revoked;
  }

  private usableAccessToken(
    connection: AiProviderConnectionEntity,
  ): string | null {
    if (
      connection.status !== AiProviderConnectionStatus.CONNECTED ||
      !connection.accessTokenExpiresAt ||
      connection.accessTokenExpiresAt.getTime() - Date.now() <= REFRESH_SKEW_MS
    ) {
      return null;
    }
    return this.readCredentials(connection)?.accessToken ?? null;
  }

  private readCredentials(
    connection: AiProviderConnectionEntity,
  ): StoredCredentials | null {
    if (!connection.credentials) {
      return null;
    }
    try {
      return JSON.parse(
        this.encryption.decrypt(connection.credentials),
      ) as StoredCredentials;
    } catch (error) {
      this.logger.warn({
        message: 'Stored ChatGPT credentials could not be read',
        connectionId: connection.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private writeCredentials(credentials: StoredCredentials): string {
    return this.encryption.encrypt(JSON.stringify(credentials));
  }

  private loadWithCredentials(
    manager: EntityManager,
    where: Partial<
      Pick<AiProviderConnectionEntity, 'id' | 'aiProviderId' | 'userId'>
    >,
    lock = false,
  ): Promise<AiProviderConnectionEntity | null> {
    const query = manager
      .createQueryBuilder(AiProviderConnectionEntity, 'connection')
      .addSelect('connection.credentials')
      .where(where);
    if (lock) {
      query.setLock('pessimistic_write');
    }
    return query.getOne();
  }

  private async describe(
    providerId: string,
    userId: string,
  ): Promise<AiProviderConnectionResult> {
    const [connection, pending] = await Promise.all([
      this.connections.findOne({ where: { aiProviderId: providerId, userId } }),
      this.attempts.count({
        where: {
          aiProviderId: providerId,
          userId,
          expiresAt: MoreThan(new Date()),
        },
      }),
    ]);
    return this.toResult(providerId, connection, pending > 0);
  }

  private toResult(
    providerId: string,
    connection: AiProviderConnectionEntity | null,
    isAuthorizationPending: boolean,
  ): AiProviderConnectionResult {
    const status =
      connection?.status ?? AiProviderConnectionStatus.DISCONNECTED;
    return {
      aiProviderId: providerId,
      status,
      accountEmail: connection?.externalEmail ?? null,
      canUsePlan: status === AiProviderConnectionStatus.CONNECTED,
      automatedTurnsAllowed: !!connection?.automatedTurnsAllowedAt,
      isAuthorizationPending,
      lastErrorCode: connection?.lastErrorCode ?? null,
      lastErrorAt: connection?.lastErrorAt ?? null,
      manageUsageUrl: MANAGE_USAGE_URL,
    };
  }

  private async getProvider(providerId: string): Promise<AiProviderEntity> {
    const provider = await this.providers.findOne({
      where: { id: providerId },
    });
    if (!provider) {
      throw new AiProviderNotFoundError(providerId);
    }
    if (provider.type !== AiProviderType.CHATGPT_SUBSCRIPTION) {
      throw new AiProviderConnectionNotSupportedError(providerId);
    }
    return provider;
  }

  /** The id is random and says nothing about the person; it is made once and reused. */
  private async ensureHostId(provider: AiProviderEntity): Promise<string> {
    if (provider.hostId) {
      return provider.hostId;
    }
    await this.providers
      .createQueryBuilder()
      .update()
      .set({ hostId: `urn:uuid:${randomUUID()}` })
      .where('id = :id AND host_id IS NULL', { id: provider.id })
      .execute();
    const saved = await this.providers.findOneOrFail({
      where: { id: provider.id },
    });
    return saved.hostId!;
  }

  /** Agents and deactivated people have no user and so can never have a connection. */
  private findUser(actorId: string): Promise<User | null> {
    return this.users.findOne({ where: { actorId, isActive: true } });
  }

  private async requireUser(
    providerId: string,
    actorId: string,
  ): Promise<User> {
    const user = await this.findUser(actorId);
    if (!user) {
      throw new AiProviderConnectionRequiredError(
        providerId,
        'Only a person signed in to Taico can connect a ChatGPT account.',
      );
    }
    return user;
  }
}
