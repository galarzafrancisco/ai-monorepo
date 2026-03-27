import { createServer } from 'http';

export async function createOAuthCallbackServer(): Promise<{
  redirectUri: string;
  waitForCode: (expectedState: string) => Promise<{ code: string }>;
}> {
  const server = createServer();
  let pendingResolve:
    | ((value: { code: string; state: string }) => void)
    | null = null;

  server.on('request', (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      res.statusCode = 400;
      res.end('Missing code or state');
      return;
    }

    res.statusCode = 200;
    res.end('Taico worker authorization completed. You can close this tab.');

    if (pendingResolve) {
      pendingResolve({ code, state });
      pendingResolve = null;
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind local callback server');
  }

  const redirectUri = `http://127.0.0.1:${address.port}/callback`;

  return {
    redirectUri,
    waitForCode: async (expectedState: string) => {
      const result = await new Promise<{ code: string; state: string }>(
        (resolve) => {
          pendingResolve = resolve;
        },
      );
      server.close();
      if (result.state !== expectedState) {
        throw new Error('OAuth callback state mismatch');
      }
      return { code: result.code };
    },
  };
}
