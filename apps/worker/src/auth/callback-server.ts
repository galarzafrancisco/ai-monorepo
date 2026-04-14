import { createServer } from 'http';

export async function createOAuthCallbackServer(
  serverUrl: string,
): Promise<{
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
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(generateSuccessPage(serverUrl));

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

function generateSuccessPage(serverUrl: string): string {
  // Build redirect URL safely and escape for HTML/JS contexts
  const redirectUrl = new URL('/settings/workers', serverUrl).toString();
  const escapedHtmlUrl = redirectUrl
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const escapedJsUrl = JSON.stringify(redirectUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Worker Paired - Taico</title>
  <style>
    /* Design tokens - Light theme */
    :root {
      --bg: #ffffff;
      --surface: #f6f8fa;
      --text: #1f2328;
      --text-muted: #59636e;
      --border: #d1d9e0;
      --accent: #0969da;
      --accent-hover: #0550ae;
      --success: #1a7f37;
      --space-4: 16px;
      --space-5: 24px;
      --space-6: 32px;
      --r-3: 8px;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      --fs-2: 14px;
      --fs-3: 16px;
      --fs-5: 24px;
      --fw-normal: 400;
      --fw-semibold: 600;
      --lh-normal: 1.5;
      --shadow-2: 0 4px 8px rgba(31, 35, 40, 0.12);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--font-sans);
      background: var(--surface);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: var(--space-5);
      line-height: var(--lh-normal);
    }

    .container {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--r-3);
      padding: var(--space-6);
      max-width: 480px;
      width: 100%;
      box-shadow: var(--shadow-2);
      text-align: center;
    }

    .icon {
      width: 48px;
      height: 48px;
      margin: 0 auto var(--space-5);
      background: var(--success);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .checkmark {
      width: 24px;
      height: 24px;
      stroke: white;
      stroke-width: 3;
      fill: none;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    h1 {
      font-size: var(--fs-5);
      font-weight: var(--fw-semibold);
      margin-bottom: var(--space-4);
      color: var(--text);
    }

    p {
      font-size: var(--fs-3);
      color: var(--text-muted);
      margin-bottom: var(--space-5);
    }

    .countdown {
      font-size: var(--fs-3);
      color: var(--text);
      margin-top: var(--space-5);
    }

    .countdown-number {
      font-weight: var(--fw-semibold);
      color: var(--accent);
      font-size: var(--fs-5);
    }

    .manual-link {
      margin-top: var(--space-5);
      padding-top: var(--space-5);
      border-top: 1px solid var(--border);
    }

    .manual-link a {
      color: var(--accent);
      text-decoration: none;
      font-size: var(--fs-2);
    }

    .manual-link a:hover {
      color: var(--accent-hover);
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg class="checkmark" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </div>
    <h1>Worker Successfully Paired</h1>
    <p>Your Taico worker has been successfully paired with the server. You can now close this tab or wait to be redirected.</p>
    <div class="countdown">
      Redirecting in <span class="countdown-number" id="countdown">5</span> seconds...
    </div>
    <div class="manual-link">
      <a href="${escapedHtmlUrl}" id="manual-link">Go to Workers page now</a>
    </div>
  </div>

  <script>
    let count = 5;
    const countdownElement = document.getElementById('countdown');
    const redirectUrl = ${escapedJsUrl};

    const interval = setInterval(() => {
      count--;

      if (count === 0) {
        clearInterval(interval);
        window.location.href = redirectUrl;
      } else {
        if (countdownElement) {
          countdownElement.textContent = count.toString();
        }
      }
    }, 1000);

    // Also allow manual click during countdown
    document.getElementById('manual-link')?.addEventListener('click', () => {
      clearInterval(interval);
    });
  </script>
</body>
</html>`;
}
