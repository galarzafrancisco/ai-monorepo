import { Injectable, Logger } from '@nestjs/common';
import { createLocalJWKSet, errors, JSONWebKeySet, jwtVerify } from 'jose';
import { RegisteredClientEntity } from './entities/registered-client.entity';
import { InvalidClientAssertionError } from './errors/token.errors';
import {
  ClientMetadataDocumentFetcher,
  ClientMetadataFetchError,
} from './client-metadata-document.fetcher';
import { cacheSeconds } from './utils/cache-control';
import {
  CLIENT_ASSERTION_SIGNING_ALGORITHMS,
  JWT_BEARER_CLIENT_ASSERTION_TYPE,
  parsePublicJwks,
} from './utils/client-assertion';

const CLOCK_TOLERANCE_SECONDS = 30;
const MAX_CACHED_KEY_SETS = 500;

type CachedKeySet = {
  keys: JSONWebKeySet;
  fetchedAt: number;
  expiresAt: number;
};

export type ClientAssertion = {
  client_assertion_type?: string;
  client_assertion?: string;
};

/**
 * Client authentication with a signed JWT (private_key_jwt, RFC 7523).
 *
 * The client signs a short-lived JWT with its private key and sends it with
 * every token request. Its public keys come from its metadata document, so a
 * stolen authorization code or refresh token is useless without the key.
 */
@Injectable()
export class ClientAssertionService {
  private readonly logger = new Logger(ClientAssertionService.name);
  // Public keys only, so a per-process cache is enough
  private readonly keySets = new Map<string, CachedKeySet>();

  constructor(private readonly fetcher: ClientMetadataDocumentFetcher) {}

  /**
   * Verifies that the request was sent by `client`.
   * `audiences` are the values the assertion may name as its audience: this
   * authorization server's issuer identifier and its token endpoint.
   */
  async authenticate(
    client: RegisteredClientEntity,
    request: ClientAssertion,
    audiences: string[],
  ): Promise<void> {
    const reject = (reason: string): never => {
      this.logger.warn(
        `Client assertion refused for ${client.clientId}: ${reason}`,
      );
      throw new InvalidClientAssertionError(reason);
    };

    if (!request.client_assertion) {
      reject('this client must authenticate with a client_assertion');
    }
    if (request.client_assertion_type !== JWT_BEARER_CLIENT_ASSERTION_TYPE) {
      reject(
        `client_assertion_type must be ${JWT_BEARER_CLIENT_ASSERTION_TYPE}`,
      );
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
        await verify(await this.keysOf(client, false));
      } catch (error) {
        // The client may have rotated its keys since we last looked
        if (
          !(error instanceof errors.JWKSNoMatchingKey) ||
          !this.mayRefetch(client)
        ) {
          throw error;
        }
        await verify(await this.keysOf(client, true));
      }
    } catch (error) {
      if (error instanceof InvalidClientAssertionError) {
        throw error;
      }
      if (error instanceof ClientMetadataFetchError) {
        return reject(
          `the client's keys could not be fetched: ${error.message}`,
        );
      }
      if (error instanceof errors.JWTClaimValidationFailed) {
        // The claim is from an unverified or mis-addressed token, so it only
        // goes to the log, where it shows what the client actually sent.
        this.logger.warn(
          `Assertion "${error.claim}" was ${JSON.stringify(error.payload?.[error.claim])}, accepted audiences: ${audiences.join(', ')}`,
        );
      }
      if (error instanceof errors.JOSEError) {
        return reject(describe(error));
      }
      throw error;
    }
  }

  private mayRefetch(client: RegisteredClientEntity): boolean {
    const cached = client.jwksUri ? this.keySets.get(client.jwksUri) : null;
    return (
      !!cached &&
      Date.now() - cached.fetchedAt >= this.fetcher.minKeySetRefetchIntervalMs
    );
  }

  private async keysOf(
    client: RegisteredClientEntity,
    refetch: boolean,
  ): Promise<JSONWebKeySet> {
    if (client.jwks) {
      return client.jwks as unknown as JSONWebKeySet;
    }
    if (!client.jwksUri) {
      throw new InvalidClientAssertionError('the client has published no keys');
    }

    const cached = this.keySets.get(client.jwksUri);
    if (cached && !refetch && cached.expiresAt > Date.now()) {
      return cached.keys;
    }

    const fetched = await this.fetcher.fetchKeySet(new URL(client.jwksUri));
    const keys = parsePublicJwks(fetched.body, (reason) => {
      throw new InvalidClientAssertionError(
        `the client's key set is invalid: ${reason}`,
      );
    }) as unknown as JSONWebKeySet;

    if (this.keySets.size >= MAX_CACHED_KEY_SETS) {
      this.keySets.clear();
    }
    this.keySets.set(client.jwksUri, {
      keys,
      fetchedAt: Date.now(),
      expiresAt: Date.now() + cacheSeconds(fetched.cacheControl) * 1000,
    });
    return keys;
  }
}

function describe(error: errors.JOSEError): string {
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
