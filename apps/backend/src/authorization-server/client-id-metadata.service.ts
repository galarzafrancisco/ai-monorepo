import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisteredClientEntity } from './entities/registered-client.entity';
import {
  ClientRegistrationMethod,
  GrantType,
  TokenEndpointAuthMethod,
} from './enums';
import { InvalidClientMetadataError } from './errors/client-registration.errors';
import {
  ClientMetadataDocumentFetcher,
  ClientMetadataFetchError,
} from './client-metadata-document.fetcher';
import { cacheSeconds } from './utils/cache-control';
import {
  CLIENT_ASSERTION_SIGNING_ALGORITHMS,
  parsePublicJwks,
} from './utils/client-assertion';
import { isAcceptableRedirectUri } from './utils/redirect-uri';

const MAX_CLIENT_NAME_LENGTH = 200;
const MAX_REDIRECT_URIS = 20;
const MAX_CLIENT_ID_LENGTH = 2048;

type ClientMetadata = {
  clientName: string;
  redirectUris: string[];
  grantTypes: GrantType[];
} & ClientAuthentication;

type ClientAuthentication = {
  tokenEndpointAuthMethod: TokenEndpointAuthMethod;
  jwksUri: string | null;
  jwks: { keys: Record<string, unknown>[] } | null;
  tokenEndpointAuthSigningAlg: string | null;
};

/**
 * OAuth Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document):
 * the client_id is an https URL, and the document at that URL describes the
 * client. There is no registration call; the document is fetched when the
 * client first shows up at the authorization endpoint, and cached.
 */
@Injectable()
export class ClientIdMetadataService {
  private readonly logger = new Logger(ClientIdMetadataService.name);

  constructor(
    @InjectRepository(RegisteredClientEntity)
    private readonly clientRepository: Repository<RegisteredClientEntity>,
    private readonly fetcher: ClientMetadataDocumentFetcher,
  ) {}

  /** Whether a client_id is a metadata document URL rather than an identifier we issued */
  isMetadataDocumentClientId(clientId: string): boolean {
    return (
      clientId.startsWith('https://') ||
      (this.fetcher.allowsInsecureLoopback && clientId.startsWith('http://'))
    );
  }

  /**
   * Returns the client behind a metadata document URL, fetching and validating
   * the document unless a cached copy is still fresh.
   */
  async resolveClient(clientId: string): Promise<RegisteredClientEntity> {
    const url = this.parseClientIdUrl(clientId);

    const cached = await this.findClient(clientId);
    if (cached?.metadataExpiresAt && cached.metadataExpiresAt > new Date()) {
      return cached;
    }

    let document: Awaited<ReturnType<ClientMetadataDocumentFetcher['fetch']>>;
    try {
      document = await this.fetchWithRetry(url);
    } catch (error) {
      if (error instanceof ClientMetadataFetchError) {
        // The client's host having a bad moment must not lock out a client we
        // already validated once (ChatGPT has been seen answering 404 for a
        // document it served fine before and after). Keep using the last
        // good copy and try again on the next request.
        if (cached) {
          this.logger.warn(
            `Could not refresh the metadata document of ${clientId} (${error.message}); using the cached copy`,
          );
          return cached;
        }
        throw new InvalidClientMetadataError(clientId, error.message);
      }
      throw error;
    }

    const metadata = this.parseDocument(clientId, document.body);
    const metadataExpiresAt = new Date(
      Date.now() + cacheSeconds(document.cacheControl) * 1000,
    );

    const client =
      cached ??
      this.clientRepository.create({
        clientId,
        clientSecret: null,
        registrationMethod: ClientRegistrationMethod.METADATA_DOCUMENT,
        scopes: [],
        contacts: null,
      });
    Object.assign(client, metadata, { metadataExpiresAt });

    try {
      return await this.clientRepository.save(client);
    } catch (error) {
      // Another request for the same new client_id (or a newer copy of its
      // document) got there first. That row is as good as ours.
      const winner = await this.findClient(clientId);
      if (winner) {
        return winner;
      }
      throw error;
    }
  }

  /** One retry, since a failure is often a blip on the client's side */
  private async fetchWithRetry(url: URL) {
    try {
      return await this.fetcher.fetch(url);
    } catch (error) {
      if (!(error instanceof ClientMetadataFetchError)) {
        throw error;
      }
      this.logger.warn(
        `Fetching ${url.href} failed (${error.message}); retrying once`,
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
      return this.fetcher.fetch(url);
    }
  }

  private findClient(clientId: string): Promise<RegisteredClientEntity | null> {
    return this.clientRepository.findOne({
      where: {
        clientId,
        registrationMethod: ClientRegistrationMethod.METADATA_DOCUMENT,
      },
    });
  }

  /** Requirements on the client_id URL itself (section 3 of the draft) */
  private parseClientIdUrl(clientId: string): URL {
    const reject = (reason: string): never => {
      throw new InvalidClientMetadataError(clientId, reason);
    };

    if (clientId.length > MAX_CLIENT_ID_LENGTH) {
      reject('the client_id URL is too long');
    }
    let url: URL;
    try {
      url = new URL(clientId);
    } catch {
      return reject('the client_id is not a valid URL');
    }
    if (
      url.protocol !== 'https:' &&
      !(this.fetcher.allowsInsecureLoopback && url.protocol === 'http:')
    ) {
      reject('the client_id URL must use https');
    }
    if (url.username || url.password) {
      reject('the client_id URL must not contain credentials');
    }
    if (clientId.includes('#')) {
      reject('the client_id URL must not contain a fragment');
    }
    if (url.pathname === '/' || url.pathname === '') {
      reject('the client_id URL must contain a path');
    }
    // new URL() resolves dot segments, so they have to be found in the raw string
    const rawPath = clientId.split(/[?#]/)[0];
    if (/\/(\.|%2e){1,2}(\/|$)/i.test(rawPath)) {
      reject('the client_id URL must not contain dot segments');
    }
    return url;
  }

  /** Requirements on the document content (sections 4 and 4.1 of the draft, plus MCP) */
  private parseDocument(clientId: string, body: unknown): ClientMetadata {
    const reject = (reason: string): never => {
      throw new InvalidClientMetadataError(clientId, reason);
    };

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return reject('the document is not a JSON object');
    }
    const document = body as Record<string, unknown>;

    // Simple string comparison, no URL normalization
    if (document.client_id !== clientId) {
      reject('its client_id does not match the URL it was fetched from');
    }

    if ('client_secret' in document || 'client_secret_expires_at' in document) {
      reject('it must not contain a client secret');
    }

    const authentication = this.parseAuthentication(clientId, document);

    const clientName =
      typeof document.client_name === 'string'
        ? // eslint-disable-next-line no-control-regex
          document.client_name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
        : '';
    if (!clientName) {
      reject('client_name is required');
    }

    const redirectUris = document.redirect_uris;
    if (
      !Array.isArray(redirectUris) ||
      redirectUris.length === 0 ||
      !redirectUris.every((uri): uri is string => typeof uri === 'string')
    ) {
      return reject('redirect_uris must be a non-empty array of strings');
    }
    if (redirectUris.length > MAX_REDIRECT_URIS) {
      reject(`redirect_uris has more than ${MAX_REDIRECT_URIS} entries`);
    }
    for (const uri of redirectUris) {
      if (!isAcceptableRedirectUri(uri)) {
        reject(
          `redirect URI ${JSON.stringify(uri)} must be https, http on localhost, or an app scheme, without a fragment`,
        );
      }
      // redirect URIs are stored as a comma-separated list
      if (uri.includes(',')) {
        reject(`redirect URI ${JSON.stringify(uri)} must not contain a comma`);
      }
    }

    const grantTypes = this.parseStringArray(
      clientId,
      document,
      'grant_types',
    ) ?? [GrantType.AUTHORIZATION_CODE];
    if (!grantTypes.includes(GrantType.AUTHORIZATION_CODE)) {
      reject('grant_types must include authorization_code');
    }

    const responseTypes = this.parseStringArray(
      clientId,
      document,
      'response_types',
    );
    if (responseTypes && !responseTypes.includes('code')) {
      reject('response_types must include code');
    }

    return {
      clientName: clientName.slice(0, MAX_CLIENT_NAME_LENGTH),
      redirectUris,
      grantTypes: Object.values(GrantType).filter((grantType) =>
        grantTypes.includes(grantType),
      ),
      ...authentication,
    };
  }

  /**
   * How the client authenticates at the token endpoint. A metadata document
   * client is either public ("none") or signs a JWT with a private key whose
   * public half it publishes ("private_key_jwt"). Shared secrets are forbidden
   * by the draft: there is no registration in which one could be agreed.
   */
  private parseAuthentication(
    clientId: string,
    document: Record<string, unknown>,
  ): ClientAuthentication {
    const reject = (reason: string): never => {
      throw new InvalidClientMetadataError(clientId, reason);
    };
    const authMethod =
      document.token_endpoint_auth_method ?? TokenEndpointAuthMethod.NONE;

    if (authMethod === TokenEndpointAuthMethod.NONE) {
      return {
        tokenEndpointAuthMethod: TokenEndpointAuthMethod.NONE,
        jwksUri: null,
        jwks: null,
        tokenEndpointAuthSigningAlg: null,
      };
    }
    if (authMethod !== TokenEndpointAuthMethod.PRIVATE_KEY_JWT) {
      return reject(
        `token_endpoint_auth_method must be "none" or "private_key_jwt", got ${JSON.stringify(authMethod)}`,
      );
    }

    const signingAlg = document.token_endpoint_auth_signing_alg;
    if (
      signingAlg !== undefined &&
      (typeof signingAlg !== 'string' ||
        !CLIENT_ASSERTION_SIGNING_ALGORITHMS.includes(signingAlg))
    ) {
      reject(
        `token_endpoint_auth_signing_alg ${JSON.stringify(signingAlg)} is not supported`,
      );
    }

    const hasJwksUri = document.jwks_uri !== undefined;
    const hasJwks = document.jwks !== undefined;
    if (hasJwksUri === hasJwks) {
      reject('private_key_jwt needs exactly one of jwks_uri and jwks');
    }

    return {
      tokenEndpointAuthMethod: TokenEndpointAuthMethod.PRIVATE_KEY_JWT,
      jwksUri: hasJwksUri
        ? this.parseJwksUri(clientId, document.jwks_uri)
        : null,
      jwks: hasJwks ? parsePublicJwks(document.jwks, reject) : null,
      tokenEndpointAuthSigningAlg: (signingAlg as string | undefined) ?? null,
    };
  }

  private parseJwksUri(clientId: string, jwksUri: unknown): string {
    const reject = (reason: string): never => {
      throw new InvalidClientMetadataError(clientId, reason);
    };
    if (typeof jwksUri !== 'string' || jwksUri.length > MAX_CLIENT_ID_LENGTH) {
      return reject('jwks_uri must be a URL');
    }
    let url: URL;
    try {
      url = new URL(jwksUri);
    } catch {
      return reject('jwks_uri must be a URL');
    }
    if (
      url.protocol !== 'https:' &&
      !(this.fetcher.allowsInsecureLoopback && url.protocol === 'http:')
    ) {
      reject('jwks_uri must use https');
    }
    if (url.username || url.password) {
      reject('jwks_uri must not contain credentials');
    }
    return jwksUri;
  }

  private parseStringArray(
    clientId: string,
    document: Record<string, unknown>,
    field: string,
  ): string[] | undefined {
    const value = document[field];
    if (value === undefined) {
      return undefined;
    }
    if (
      !Array.isArray(value) ||
      !value.every((item): item is string => typeof item === 'string')
    ) {
      throw new InvalidClientMetadataError(
        clientId,
        `${field} must be an array of strings`,
      );
    }
    return value;
  }
}
