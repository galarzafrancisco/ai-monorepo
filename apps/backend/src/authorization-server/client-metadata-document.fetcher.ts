import { Inject, Injectable } from '@nestjs/common';
import { lookup as dnsLookup } from 'dns';
import * as http from 'http';
import * as https from 'https';
import { isIP, LookupFunction } from 'net';
import { isPublicAddress } from './utils/public-address';

export const CLIENT_METADATA_FETCH_OPTIONS = Symbol(
  'CLIENT_METADATA_FETCH_OPTIONS',
);

export type ClientMetadataFetchOptions = {
  /**
   * Accept http:// URLs and hosts on loopback or private networks.
   * Only for tests, where the client's document is served from 127.0.0.1.
   */
  allowInsecureLocal: boolean;
  timeoutMs: number;
  /** The CIMD draft recommends refusing documents larger than 5 kB */
  maxBytes: number;
};

export const DEFAULT_CLIENT_METADATA_FETCH_OPTIONS: ClientMetadataFetchOptions =
  {
    allowInsecureLocal: false,
    timeoutMs: 5000,
    maxBytes: 5 * 1024,
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

  get allowsInsecureLocal(): boolean {
    return this.options.allowInsecureLocal;
  }

  async fetch(url: URL): Promise<FetchedClientMetadataDocument> {
    const { allowInsecureLocal, timeoutMs, maxBytes } = this.options;

    if (
      url.protocol !== 'https:' &&
      !(allowInsecureLocal && url.protocol === 'http:')
    ) {
      throw new ClientMetadataFetchError('the URL must use https');
    }

    // net.connect skips the DNS lookup for IP literals, so check those here
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isIP(host) && !allowInsecureLocal && !isPublicAddress(host)) {
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
          lookup: allowInsecureLocal ? undefined : publicOnlyLookup,
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
 * DNS lookup that refuses hosts with any non-public address. Passing it as the
 * socket's lookup means the connection uses the very addresses that were
 * checked, so a second DNS answer cannot swap in an internal address.
 */
const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) {
      return callback(error, '', 0);
    }
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => !isPublicAddress(address))
    ) {
      return callback(
        new ClientMetadataFetchError(
          'the URL resolves to a non-public address',
        ),
        '',
        0,
      );
    }
    if (options.all) {
      return callback(null, addresses);
    }
    callback(null, addresses[0].address, addresses[0].family);
  });
};
