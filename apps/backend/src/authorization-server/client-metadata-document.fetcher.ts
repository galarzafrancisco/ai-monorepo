import { Inject, Injectable } from '@nestjs/common';
import { lookup as dnsLookup, LookupAddress } from 'dns';
import * as http from 'http';
import * as https from 'https';
import { isIP, LookupFunction } from 'net';
import { isLoopbackAddress, isPublicAddress } from './utils/public-address';

export const CLIENT_METADATA_FETCH_OPTIONS = Symbol(
  'CLIENT_METADATA_FETCH_OPTIONS',
);

export type ClientMetadataFetchOptions = {
  /**
   * Also accept http:// URLs and this machine's loopback addresses.
   * Only for tests, where the client's document is served from 127.0.0.1.
   * Private networks and link-local addresses stay refused.
   */
  allowInsecureLoopback: boolean;
  timeoutMs: number;
  /** The CIMD draft recommends refusing documents larger than 5 kB */
  maxBytes: number;
  /** Key sets hold a few public keys each, which need more room than a document */
  maxKeySetBytes: number;
  /**
   * How soon a client's key set may be fetched again when an assertion names
   * a key that is not in the cached copy. Stops a stream of bad assertions
   * from becoming a stream of outbound requests.
   */
  minKeySetRefetchIntervalMs: number;
};

export const DEFAULT_CLIENT_METADATA_FETCH_OPTIONS: ClientMetadataFetchOptions =
  {
    allowInsecureLoopback: false,
    timeoutMs: 5000,
    maxBytes: 5 * 1024,
    maxKeySetBytes: 64 * 1024,
    minKeySetRefetchIntervalMs: 60 * 1000,
  };

export type FetchedClientMetadataDocument = {
  body: unknown;
  /** Raw Cache-Control response header, if any */
  cacheControl: string | null;
};

export class ClientMetadataFetchError extends Error {}

/**
 * Fetches a Client ID Metadata Document from a URL chosen by whoever sent the
 * authorization request, so every request is treated as hostile (SSRF):
 * https only, public addresses only, no redirects, and a short timeout and a
 * size cap on the response.
 */
@Injectable()
export class ClientMetadataDocumentFetcher {
  constructor(
    @Inject(CLIENT_METADATA_FETCH_OPTIONS)
    private readonly options: ClientMetadataFetchOptions,
  ) {}

  get allowsInsecureLoopback(): boolean {
    return this.options.allowInsecureLoopback;
  }

  get minKeySetRefetchIntervalMs(): number {
    return this.options.minKeySetRefetchIntervalMs;
  }

  /** Fetches a client's JWK Set, under the same rules as its metadata document */
  fetchKeySet(url: URL): Promise<FetchedClientMetadataDocument> {
    return this.fetch(url, this.options.maxKeySetBytes);
  }

  async fetch(
    url: URL,
    maxBytes = this.options.maxBytes,
  ): Promise<FetchedClientMetadataDocument> {
    const { allowInsecureLoopback, timeoutMs } = this.options;

    if (
      url.protocol !== 'https:' &&
      !(allowInsecureLoopback && url.protocol === 'http:')
    ) {
      throw new ClientMetadataFetchError('the URL must use https');
    }

    // Plain http is only ever spoken to this machine, never across a network
    const isAllowedAddress = (address: string) =>
      url.protocol === 'https:'
        ? isPublicAddress(address) ||
          (allowInsecureLoopback && isLoopbackAddress(address))
        : isLoopbackAddress(address);

    // net.connect skips the DNS lookup for IP literals, so check those here
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && !isAllowedAddress(host)) {
      throw new ClientMetadataFetchError(
        'the URL resolves to a non-public address',
      );
    }

    const transport = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const fail = (reason: string) =>
        reject(new ClientMetadataFetchError(reason));

      const request = transport.request(
        url,
        {
          method: 'GET',
          headers: { accept: 'application/json' },
          // A fresh connection per fetch: the address checked by the lookup
          // is the address connected to, with no pooled socket in between.
          agent: false,
          lookup: restrictedLookup(isAllowedAddress),
          signal: AbortSignal.timeout(timeoutMs),
        },
        (response) => {
          if (response.statusCode !== 200) {
            response.destroy();
            // Redirects are not followed: the document must live at the client_id URL
            return fail(`the URL responded with HTTP ${response.statusCode}`);
          }

          const contentType = response.headers['content-type'] ?? '';
          if (!/json/i.test(contentType)) {
            response.destroy();
            return fail('the response is not JSON');
          }

          const chunks: Buffer[] = [];
          let received = 0;
          response.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (received > maxBytes) {
              response.destroy();
              return fail(`the document is larger than ${maxBytes} bytes`);
            }
            chunks.push(chunk);
          });
          response.on('error', () => fail('the response was interrupted'));
          response.on('end', () => {
            try {
              const cacheControl = response.headers['cache-control'];
              resolve({
                body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
                cacheControl: cacheControl ?? null,
              });
            } catch {
              fail('the response is not valid JSON');
            }
          });
        },
      );

      request.on('error', (error: NodeJS.ErrnoException) => {
        if (error instanceof ClientMetadataFetchError) {
          return reject(error);
        }
        fail(
          error.name === 'TimeoutError' || error.name === 'AbortError'
            ? 'the request timed out'
            : `the request failed (${error.code ?? error.name})`,
        );
      });
      request.end();
    });
  }
}

/**
 * DNS lookup that only hands allowed addresses to the socket, and fails when
 * a host has none. A host can legitimately answer with a mix, for example
 * split-horizon DNS; its other addresses are dropped rather than the whole
 * host refused. Passing this as the socket's lookup means the connection uses
 * the very addresses that were checked, so a second DNS answer cannot swap in
 * an internal address.
 */
function restrictedLookup(
  isAllowedAddress: (address: string) => boolean,
): LookupFunction {
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) {
        return callback(error, '', 0);
      }
      const allowed = allowedAddressesOf(addresses, isAllowedAddress);
      if (allowed.length === 0) {
        return callback(
          new ClientMetadataFetchError(
            'the URL resolves to a non-public address',
          ),
          '',
          0,
        );
      }
      if (options.all) {
        return callback(null, allowed);
      }
      callback(null, allowed[0].address, allowed[0].family);
    });
  };
}

export function allowedAddressesOf(
  addresses: LookupAddress[],
  isAllowedAddress: (address: string) => boolean,
): LookupAddress[] {
  return addresses.filter(({ address }) => isAllowedAddress(address));
}
