import type { ConsentDetails } from './oauth-server.js';

/*
 * The built-in login and consent pages: plain HTML forms, no script. They
 * exist so that an authorization server works out of the box; a host with
 * its own UI points `consentUrl` at it and turns these off.
 */

/** Escapes text for HTML element content and quoted attribute values */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Headers every page is sent with. No script may run, and no other site may
 * frame the page, so the consent buttons cannot be clickjacked.
 * `same-origin` keeps the `Origin` header on the forms' POSTs, which the
 * CSRF check needs; `no-referrer` would make browsers send `Origin: null`.
 */
export const PAGE_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'",
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'cache-control': 'no-store',
};

const STYLE = `
body{font-family:system-ui,sans-serif;background:#f5f5f4;color:#1c1917;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}
main{background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:2rem;max-width:26rem;width:calc(100% - 2rem);box-sizing:border-box}
h1{font-size:1.25rem;margin:0 0 1rem}
p{line-height:1.5}
label{display:block;margin:.75rem 0 .25rem;font-size:.875rem}
input{width:100%;box-sizing:border-box;padding:.5rem;border:1px solid #d6d3d1;border-radius:6px;font:inherit}
button{font:inherit;padding:.5rem 1rem;border-radius:6px;border:1px solid #1c1917;background:#1c1917;color:#fff;cursor:pointer}
button.secondary{background:#fff;color:#1c1917}
.actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:1.5rem}
.error{color:#b91c1c}
.muted{color:#78716c;font-size:.875rem}
ul{padding-left:1.25rem}
code{word-break:break-all}
`;

export function page(title: string, content: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${STYLE}</style>
</head>
<body><main>${content}</main></body>
</html>`;
}

export function loginPage(input: {
  action: string;
  returnTo: string;
  error?: boolean;
}): string {
  return page(
    'Sign in',
    `<h1>Sign in</h1>
${input.error ? '<p class="error" role="alert">Wrong email or password.</p>' : ''}
<form method="post" action="${escapeHtml(input.action)}">
<input type="hidden" name="return_to" value="${escapeHtml(input.returnTo)}">
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="username" required autofocus>
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="current-password" required>
<div class="actions"><button type="submit">Sign in</button></div>
</form>`,
  );
}

export function consentPage(input: {
  action: string;
  consent: ConsentDetails;
}): string {
  const { consent } = input;
  let redirectTarget = consent.redirectUri;
  try {
    const url = new URL(consent.redirectUri);
    redirectTarget = url.protocol === 'http:' || url.protocol === 'https:' ? url.host : url.protocol;
  } catch {
    // Shown as registered
  }
  const scopes = consent.scopes.length
    ? `<ul>${consent.scopes
        .map(
          (scope) =>
            `<li><code>${escapeHtml(scope.id)}</code>${
              scope.description ? ` — ${escapeHtml(scope.description)}` : ''
            }</li>`,
        )
        .join('')}</ul>`
    : '<p>No specific permissions.</p>';
  // A dynamically registered client named itself; say so
  const method = consent.client.registrationMethod;
  const unverified =
    method === 'metadata_document'
      ? `<p class="muted">Client identified by <code>${escapeHtml(consent.client.clientId)}</code>.</p>`
      : method === 'dynamic_registration'
        ? '<p class="muted">The application named itself. Only allow it if you started this.</p>'
        : '';
  return page(
    'Allow access?',
    `<h1>Allow access?</h1>
<p><strong>${escapeHtml(consent.client.clientName)}</strong> wants to access
<strong>${escapeHtml(consent.resource.name)}</strong> on your behalf.</p>
${unverified}
<p>It is asking to:</p>
${scopes}
<p class="muted">You will be sent back to <code>${escapeHtml(redirectTarget)}</code>.</p>
<form method="post" action="${escapeHtml(input.action)}">
<input type="hidden" name="grant_id" value="${escapeHtml(consent.grantId)}">
<div class="actions">
<button type="submit" name="approved" value="false" class="secondary">Deny</button>
<button type="submit" name="approved" value="true">Allow</button>
</div>
</form>`,
  );
}

export function messagePage(title: string, message: string): string {
  return page(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>`);
}
