import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import {
  ClientMetadataDocumentFetcher,
  ClientMetadataFetchError,
  DEFAULT_CLIENT_METADATA_FETCH_OPTIONS,
  allowedAddressesOf,
} from './client-metadata-document.fetcher';
import { isPublicAddress } from './utils/public-address';

describe('ClientMetadataDocumentFetcher', () => {
  describe('with the production policy', () => {
    const fetcher = new ClientMetadataDocumentFetcher(
      DEFAULT_CLIENT_METADATA_FETCH_OPTIONS,
    );

    it.each([
      ['plain http', 'http://example.com/client.json', /must use https/],
      ['a loopback address', 'https://127.0.0.1/client.json', /non-public/],
      ['a private address', 'https://10.0.0.5/client.json', /non-public/],
      [
        'the cloud metadata address',
        'https://169.254.169.254/latest',
        /non-public/,
      ],
      ['an IPv6 loopback address', 'https://[::1]/client.json', /non-public/],
      [
        'an IPv4-mapped loopback address',
        'https://[::ffff:127.0.0.1]/c.json',
        /non-public/,
      ],
      // Resolved through DNS, so this exercises the lookup the socket uses
      [
        'a name that resolves to loopback',
        'https://localhost/client.json',
        /non-public/,
      ],
    ])('refuses %s', async (_name, url, reason) => {
      const fetching = fetcher.fetch(new URL(url));
      await expect(fetching).rejects.toBeInstanceOf(ClientMetadataFetchError);
      await expect(fetching).rejects.toThrow(reason);
    });
  });

  describe('allowedAddressesOf', () => {
    it('keeps only the allowed addresses of a host that also has others', () => {
      expect(
        allowedAddressesOf(
          [
            { address: '10.0.0.5', family: 4 },
            { address: '93.184.216.34', family: 4 },
            { address: 'fd00::1', family: 6 },
          ],
          isPublicAddress,
        ),
      ).toEqual([{ address: '93.184.216.34', family: 4 }]);
    });

    it('leaves nothing to connect to for a host with no allowed address', () => {
      expect(
        allowedAddressesOf(
          [
            { address: '10.0.0.5', family: 4 },
            { address: '::1', family: 6 },
          ],
          isPublicAddress,
        ),
      ).toEqual([]);
    });
  });

  describe('against a local server', () => {
    let server: Server;
    let origin: string;
    let respond: (response: import('http').ServerResponse) => void = () =>
      undefined;

    const fetcher = new ClientMetadataDocumentFetcher({
      allowInsecureLoopback: true,
      timeoutMs: 300,
      maxBytes: 1024,
    });

    beforeAll(async () => {
      server = createServer((_request, response) => respond(response));
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    });

    const json = { 'content-type': 'application/json' };

    it.each([
      ['a private address', 'http://10.0.0.5/client.json'],
      ['the cloud metadata address', 'http://169.254.169.254/latest'],
      ['a link-local IPv6 address', 'http://[fe80::1]/client.json'],
    ])(
      'still refuses %s when loopback is allowed for tests',
      async (_name, url) => {
        await expect(fetcher.fetch(new URL(url))).rejects.toThrow(/non-public/);
      },
    );

    it('returns the parsed document and its Cache-Control header', async () => {
      respond = (response) =>
        response
          .writeHead(200, { ...json, 'cache-control': 'max-age=120' })
          .end('{"client_name":"x"}');

      await expect(fetcher.fetch(new URL(`${origin}/c.json`))).resolves.toEqual(
        {
          body: { client_name: 'x' },
          cacheControl: 'max-age=120',
        },
      );
    });

    it('does not follow redirects', async () => {
      respond = (response) =>
        response.writeHead(302, { location: `${origin}/elsewhere` }).end();

      await expect(fetcher.fetch(new URL(`${origin}/c.json`))).rejects.toThrow(
        /HTTP 302/,
      );
    });

    it('refuses a response that is not JSON', async () => {
      respond = (response) =>
        response.writeHead(200, { 'content-type': 'text/html' }).end('{}');

      await expect(fetcher.fetch(new URL(`${origin}/c.json`))).rejects.toThrow(
        /not JSON/,
      );
    });

    it('stops reading a document that is too large', async () => {
      respond = (response) => {
        response.writeHead(200, json);
        // No Content-Length: the limit has to hold for the bytes received
        response.write('"' + 'x'.repeat(600));
        response.end('x'.repeat(600) + '"');
      };

      await expect(fetcher.fetch(new URL(`${origin}/c.json`))).rejects.toThrow(
        /larger than 1024 bytes/,
      );
    });

    it('gives up on a server that does not answer in time', async () => {
      respond = () => undefined;

      await expect(fetcher.fetch(new URL(`${origin}/c.json`))).rejects.toThrow(
        /timed out/,
      );
    });

    it('gives up on a server that stalls in the middle of the document', async () => {
      respond = (response) => {
        response.writeHead(200, json);
        response.write('{"client_name":');
      };

      await expect(fetcher.fetch(new URL(`${origin}/c.json`))).rejects.toThrow(
        /timed out|interrupted/,
      );
    });
  });
});
