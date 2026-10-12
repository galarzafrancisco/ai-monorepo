import { randomBytes } from 'node:crypto';
import {
  createLocalJWKSet,
  errors,
  jwtVerify,
  type JSONWebKeySet,
} from 'jose';
import { cacheSeconds } from './cache-control.js';
import {
  ClientMetadataDocumentFetcher,
  ClientMetadataFetchError,
} from './client-metadata-fetcher.js';
import { OAuthError } from './errors.js';
import {
  CLIENT_ASSERTION_SIGNING_ALGORITHMS,
  JWT_BEARER_CLIENT_ASSERTION_TYPE,
  parsePublicJwks,
} from './jwks-validation.js';
import type { Client, ClientStore } from './ports.js';
import { isAcceptableRedirectUri } from './redirect-uri.js';
import { parseScope } from './scopes.js';
import {
  silentLogger,
  systemClock,
  type Clock,
  type Logger,
} from './types.js';

const MAX_CLIENT_NAME_LENGTH = 200;
const MAX_REDIRECT_URIS = 20;
const MAX_CLIENT_ID_LENGTH = 2048;
const CLOCK_TOLERANCE_SECONDS = 30;
const MAX_CACHED_KEY_SETS = 500;
// A key the client withdrew stops working within this time, whatever cache
// lifetime the client's own server asked for.
const MAX_KEY_SET_CACHE_SECONDS = 60 * 60;

const GRANT_TYPES = ['authorization_code', 'refresh_token'];

type CachedKeySet = { keys: JSONWebKeySet; fetchedAt: number; expiresAt: number };

export type ClientAssertion = {
  client_assertion_type?: string;
  client_assertion?: string;
};

/** RFC 7591 client metadata, as sent to the registration endpoint */
export type ClientRegistrationRequest = {
  client_name?: unknown;
  redirect_uris?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
  token_endpoint_auth_method?: unknown;
  scope?: unknown;
  contacts?: unknown;
};

function invalidMetadata(reason: string): never {
  throw new OAuthError('invalid_client_metadata', reason);
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

/**
 * Everything about OAuth clients: registering them (RFC 7591), resolving the
 * ones that identify themselves with a metadata document URL
 * (draft-ietf-oauth-client-id-metadata-document), and authenticating the ones
 * that sign assertions (private_key_jwt, RFC 7523).
 */
export class ClientDirectory {
  // Public keys only, so a per-process cache is enough
  private readonly keySets = new Map<string, CachedKeySet>();

  constructor(
    private readonly store: ClientStore,
    private readonly fetcher: ClientMetadataDocumentFetcher,
    private readonly clock: Clock = systemClock,
    private readonly logger: Logger = silentLogger,
  ) {}

  /** Whether a client_id is a metadata document URL rather than one we issued */
  isMetadataDocumentClientId(clientId: string): boolean {
    return (
      clientId.startsWith('https://') ||
      (this.fetcher.allowsInsecureLoopback && clientId.startsWith('http://'))
    );
  }

  /** The client behind a client_id, or an `invalid_client` error */
  async resolve(clientId: string): Promise<Client> {
    if (this.isMetadataDocumentClientId(clientId)) {
      return this.resolveMetadataDocumentClient(clientId);
    }
    const client = await this.store.findByClientId(clientId);
    if (!client || client.registrationMethod === 'metadata_document') {
      throw new OAuthError('invalid_client', `Unknown client: ${clientId}`, 401);
    }
    return client;
  }

  // -------------------------------------------------------------- registration

  /**
   * Dynamic client registration. Only public clients can register this way:
   * a registered client has nowhere to publish keys, and shared secrets are
   * not supported. PKCE is what protects a public client's flow.
   */
  async register(request: ClientRegistrationRequest): Promise<Client> {
    const clientName =
      typeof request.client_name === 'string' ? request.client_name.trim() : '';
    if (!clientName) {
      invalidMetadata('client_name is required');
    }

    const redirectUris = request.redirect_uris;
    if (!isStringArray(redirectUris) || redirectUris.length === 0) {
      throw new OAuthError(
        'invalid_redirect_uri',
        'redirect_uris must be a non-empty array of strings',
      );
    }
    if (redirectUris.length > MAX_REDIRECT_URIS) {
      throw new OAuthError(
        'invalid_redirect_uri',
        `redirect_uris has more than ${MAX_REDIRECT_URIS} entries`,
      );
    }
    for (const uri of redirectUris) {
      // Registered clients may use plain http redirect URIs on any host
      // (native and local tools); the scheme blocklist still applies.
      if (!isAcceptableRedirectUri(uri) && !/^http:\/\/[^/]/i.test(uri)) {
        throw new OAuthError(
          'invalid_redirect_uri',
          `Redirect URI ${JSON.stringify(uri)} is not allowed`,
        );
      }
      if (uri.includes('#')) {
        throw new OAuthError(
          'invalid_redirect_uri',
          `Redirect URI ${JSON.stringify(uri)} must not contain a fragment`,
        );
      }
    }

    const grantTypes = request.grant_types ?? ['authorization_code'];
    if (!isStringArray(grantTypes) || !grantTypes.includes('authorization_code')) {
      invalidMetadata('grant_types must include authorization_code');
    }
    const authMethod = request.token_endpoint_auth_method ?? 'none';
    if (authMethod !== 'none') {
      invalidMetadata(
        'token_endpoint_auth_method must be "none": registered clients are public clients',
      );
    }

    return this.store.save({
      clientId: randomBytes(16).toString('hex'),
      clientName: clientName.slice(0, MAX_CLIENT_NAME_LENGTH),
      redirectUris,
      grantTypes: GRANT_TYPES.filter((type) =>
        (grantTypes as string[]).includes(type),
      ),
      tokenEndpointAuthMethod: 'none',
      registrationMethod: 'dynamic_registration',
      scopes: parseScope(request.scope),
      contacts: isStringArray(request.contacts) ? request.contacts : null,
      jwksUri: null,
      jwks: null,
      tokenEndpointAuthSigningAlg: null,
      metadataExpiresAt: null,
      createdAt: this.clock.now(),
    });
  }

  // -------------------------------------------------------------- metadata documents

  private async resolveMetadataDocumentClient(clientId: string): Promise<Client> {
    const url = this.parseClientIdUrl(clientId);

    const cached = await this.store.findByClientId(clientId);
    if (cached && cached.registrationMethod !== 'metadata_document') {
      throw new OAuthError('invalid_client', `Unknown client: ${clientId}`, 401);
    }
    if (cached?.metadataExpiresAt && cached.metadataExpiresAt > this.clock.now()) {
      return cached;
    }

    let document: Awaited<ReturnType<ClientMetadataDocumentFetcher['fetch']>>;
    try {
      document = await this.fetcher.fetch(url);
    } catch (error) {
      if (error instanceof ClientMetadataFetchError) {
        return invalidMetadata(
          `The metadata document of ${clientId} could not be used: ${error.message}`,
        );
      }
      throw error;
    }

    return this.store.save({
      ...this.parseDocument(clientId, document.body),
      clientId,
      registrationMethod: 'metadata_document',
      scopes: [],
      contacts: null,
      metadataExpiresAt: new Date(
        this.clock.now().getTime() + cacheSeconds(document.cacheControl) * 1000,
      ),
      createdAt: cached?.createdAt ?? this.clock.now(),
    });
  }

  /** Requirements on the client_id URL itself (section 3 of the draft) */
  private parseClientIdUrl(clientId: string): URL {
    const reject = (reason: string) =>
      invalidMetadata(`Invalid client_id ${clientId}: ${reason}`);

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

  /** Requirements on the document content (sections 4 and 4.1 of the draft) */
  private parseDocument(
    clientId: string,
    body: unknown,
  ): Pick<
    Client,
    | 'clientName'
    | 'redirectUris'
    | 'grantTypes'
    | 'tokenEndpointAuthMethod'
    | 'jwksUri'
    | 'jwks'
    | 'tokenEndpointAuthSigningAlg'
  > {
    const reject = (reason: string) =>
      invalidMetadata(`Invalid metadata document for ${clientId}: ${reason}`);

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

    const clientName =
      typeof document.client_name === 'string'
        ? // eslint-disable-next-line no-control-regex
          document.client_name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
        : '';
    if (!clientName) {
      reject('client_name is required');
    }

    const redirectUris = document.redirect_uris;
    if (!isStringArray(redirectUris) || redirectUris.length === 0) {
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
    }

    const stringArray = (field: string): string[] | undefined => {
      const value = document[field];
      if (value === undefined) return undefined;
      if (!isStringArray(value)) {
        return reject(`${field} must be an array of strings`);
      }
      return value;
    };
    const grantTypes = stringArray('grant_types') ?? ['authorization_code'];
    if (!grantTypes.includes('authorization_code')) {
      reject('grant_types must include authorization_code');
    }
    const responseTypes = stringArray('response_types');
    if (responseTypes && !responseTypes.includes('code')) {
      reject('response_types must include code');
    }

    return {
      clientName: clientName.slice(0, MAX_CLIENT_NAME_LENGTH),
      redirectUris,
      grantTypes: GRANT_TYPES.filter((type) => grantTypes.includes(type)),
      ...this.parseAuthentication(document, reject),
    };
  }

  /**
   * How the client authenticates at the token endpoint. A metadata document
   * client is either public ("none") or signs a JWT with a private key whose
   * public half it publishes ("private_key_jwt"). Shared secrets are forbidden
   * by the draft: there is no registration in which one could be agreed.
   */
  private parseAuthentication(
    document: Record<string, unknown>,
    reject: (reason: string) => never,
  ): Pick<
    Client,
    'tokenEndpointAuthMethod' | 'jwksUri' | 'jwks' | 'tokenEndpointAuthSigningAlg'
  > {
    const authMethod = document.token_endpoint_auth_method ?? 'none';
    if (authMethod === 'none') {
      return {
        tokenEndpointAuthMethod: 'none',
        jwksUri: null,
        jwks: null,
        tokenEndpointAuthSigningAlg: null,
      };
    }
    if (authMethod !== 'private_key_jwt') {
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
      tokenEndpointAuthMethod: 'private_key_jwt',
      jwksUri: hasJwksUri ? this.parseJwksUri(document.jwks_uri, reject) : null,
      jwks: hasJwks ? parsePublicJwks(document.jwks, reject) : null,
      tokenEndpointAuthSigningAlg: (signingAlg as string | undefined) ?? null,
    };
  }

  private parseJwksUri(jwksUri: unknown, reject: (reason: string) => never): string {
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

  // -------------------------------------------------------------- authentication

  /**
   * Verifies that a token request was sent by `client`, when the client is
   * one that must prove it. `audiences` are the values an assertion may name
   * as its audience: the issuer identifier and the token endpoint.
   */
  async authenticate(
    client: Client,
    request: ClientAssertion & { client_id?: string },
    audiences: string[],
  ): Promise<void> {
    if (request.client_id !== undefined && request.client_id !== client.clientId) {
      throw new OAuthError('invalid_grant', 'Client ID mismatch');
    }
    if (client.tokenEndpointAuthMethod !== 'private_key_jwt') {
      // A public client only names itself; PKCE ties the request to the grant
      if (request.client_id === undefined) {
        throw new OAuthError('invalid_request', 'client_id is required');
      }
      return;
    }

    const reject = (reason: string): never => {
      this.logger.warn(`Client assertion refused for ${client.clientId}: ${reason}`);
      throw new OAuthError('invalid_client', reason, 401);
    };

    if (!request.client_assertion) {
      reject('this client must authenticate with a client_assertion');
    }
    if (request.client_assertion_type !== JWT_BEARER_CLIENT_ASSERTION_TYPE) {
      reject(`client_assertion_type must be ${JWT_BEARER_CLIENT_ASSERTION_TYPE}`);
    }
    const assertion = request.client_assertion!;

    const verify = async (keys: JSONWebKeySet) =>
      jwtVerify(assertion, createLocalJWKSet(keys), {
        // RFC 7523 section 3: the client is both the issuer and the subject
        issuer: client.clientId,
        subject: client.clientId,
        audience: audiences,
        algorithms: client.tokenEndpointAuthSigningAlg
          ? [client.tokenEndpointAuthSigningAlg]
          : CLIENT_ASSERTION_SIGNING_ALGORITHMS,
        requiredClaims: ['exp'],
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      });

    try {
      try {
        await verify(await this.keysOf(client, false, reject));
      } catch (error) {
        // The client may have rotated its keys since we last looked
        if (!(error instanceof errors.JWKSNoMatchingKey) || !this.mayRefetch(client)) {
          throw error;
        }
        await verify(await this.keysOf(client, true, reject));
      }
    } catch (error) {
      if (error instanceof OAuthError) {
        throw error;
      }
      if (error instanceof ClientMetadataFetchError) {
        return reject(`the client's keys could not be fetched: ${error.message}`);
      }
      if (error instanceof errors.JOSEError) {
        return reject(describeAssertionError(error));
      }
      throw error;
    }
  }

  private mayRefetch(client: Client): boolean {
    const cached = client.jwksUri ? this.keySets.get(client.jwksUri) : null;
    return (
      !!cached &&
      Date.now() - cached.fetchedAt >= this.fetcher.minKeySetRefetchIntervalMs
    );
  }

  private async keysOf(
    client: Client,
    refetch: boolean,
    reject: (reason: string) => never,
  ): Promise<JSONWebKeySet> {
    if (client.jwks) {
      return client.jwks as unknown as JSONWebKeySet;
    }
    if (!client.jwksUri) {
      return reject('the client has published no keys');
    }

    const cached = this.keySets.get(client.jwksUri);
    if (cached && !refetch && cached.expiresAt > Date.now()) {
      return cached.keys;
    }

    const fetched = await this.fetcher.fetchKeySet(new URL(client.jwksUri));
    const keys = parsePublicJwks(fetched.body, (reason) =>
      reject(`the client's key set is invalid: ${reason}`),
    ) as unknown as JSONWebKeySet;

    if (this.keySets.size >= MAX_CACHED_KEY_SETS) {
      this.keySets.clear();
    }
    this.keySets.set(client.jwksUri, {
      keys,
      fetchedAt: Date.now(),
      expiresAt:
        Date.now() +
        Math.min(cacheSeconds(fetched.cacheControl), MAX_KEY_SET_CACHE_SECONDS) *
          1000,
    });
    return keys;
  }
}

function describeAssertionError(error: errors.JOSEError): string {
  if (error instanceof errors.JWTExpired) {
    return 'the assertion has expired';
  }
  if (error instanceof errors.JWTClaimValidationFailed) {
    return `the assertion's "${error.claim}" claim is not acceptable`;
  }
  if (error instanceof errors.JWKSNoMatchingKey) {
    return "the assertion is not signed with one of the client's keys";
  }
  if (error instanceof errors.JWSSignatureVerificationFailed) {
    return 'the assertion signature is invalid';
  }
  if (error instanceof errors.JOSEAlgNotAllowed) {
    return 'the assertion is signed with an algorithm that is not allowed';
  }
  return 'the assertion is not a valid signed JWT';
}
