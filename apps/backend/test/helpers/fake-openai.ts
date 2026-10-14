import { createHash, randomUUID } from 'node:crypto';
import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import type { ChatgptSubscriptionEndpoints } from '../../src/ai-providers/chatgpt-subscription/chatgpt-subscription.constants';

/**
 * A stand-in for the parts of OpenAI that Sign in with ChatGPT touches: the
 * authorization server (authorize, token, revocation, discovery, signing keys)
 * and the API (model catalog and streamed Responses). It enforces what the
 * real one does where Taico could get it wrong: PKCE, exact redirect URI,
 * refresh-token rotation, and bearer tokens.
 */

type Grant = {
  clientId: string;
  subject: string;
  email: string;
  scope: string;
  accessToken: string;
  refreshToken: string;
  revoked: boolean;
};

type PendingCode = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  nonce: string;
  subject: string;
  email: string;
  scope: string;
};

export type RecordedResponsesRequest = {
  authorization: string | undefined;
  body: Record<string, any>;
};

export type SseEvent = Record<string, unknown>;

/** What the fake answers one `POST /v1/responses` with. */
export type ScriptedResponse =
  | { events: SseEvent[]; closeWithoutCompleting?: boolean }
  | {
      status: number;
      error: { code: string; message: string; param?: string };
    };

const usage = (inputTokens = 10) => ({
  input_tokens: inputTokens,
  output_tokens: 5,
  total_tokens: inputTokens + 5,
});

const created = (): SseEvent => ({
  type: 'response.created',
  response: { id: `resp_${randomUUID()}`, created_at: 1, model: 'fake' },
});

export const completed = (inputTokens?: number): SseEvent => ({
  type: 'response.completed',
  response: { usage: usage(inputTokens) },
});

export function textEvents(text: string): SseEvent[] {
  const id = `msg_${randomUUID()}`;
  return [
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: { type: 'message', id },
    },
    {
      type: 'response.output_text.delta',
      item_id: id,
      output_index: 0,
      delta: text,
    },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: { type: 'message', id },
    },
  ];
}

export function textResponse(
  text: string,
  inputTokens?: number,
): ScriptedResponse {
  return { events: [created(), ...textEvents(text), completed(inputTokens)] };
}

export function toolCallResponse(input: {
  name: string;
  namespace?: string;
  arguments: Record<string, unknown>;
  callId?: string;
}): ScriptedResponse {
  const item = {
    type: 'function_call',
    id: `fc_${randomUUID()}`,
    call_id: input.callId ?? `call_${randomUUID()}`,
    name: input.name,
    arguments: JSON.stringify(input.arguments),
    ...(input.namespace ? { namespace: input.namespace } : {}),
  };
  return {
    events: [
      created(),
      {
        type: 'response.output_item.added',
        output_index: 0,
        item: { ...item, arguments: '' },
      },
      {
        type: 'response.output_item.done',
        output_index: 0,
        item: { ...item, status: 'completed' },
      },
      completed(),
    ],
  };
}

export function failedResponse(
  code: string,
  message: string,
  partialText?: string,
): ScriptedResponse {
  return {
    events: [
      created(),
      ...(partialText ? textEvents(partialText) : []),
      {
        type: 'response.failed',
        sequence_number: 9,
        response: { error: { code, message } },
      },
    ],
  };
}

export function incompleteResponse(
  reason: string,
  partialText: string,
): ScriptedResponse {
  return {
    events: [
      created(),
      ...textEvents(partialText),
      {
        type: 'response.incomplete',
        response: { incomplete_details: { reason }, usage: usage() },
      },
    ],
  };
}

export class FakeOpenAi {
  readonly tokenRequests: Record<string, string>[] = [];
  readonly revocations: Record<string, string>[] = [];
  readonly responsesRequests: RecordedResponsesRequest[] = [];
  readonly modelsRequests: Array<string | undefined> = [];

  /** Answers for the next Responses requests, in order. When empty, a plain text reply. */
  readonly script: ScriptedResponse[] = [];
  /** OAuth error for the next refresh, e.g. `refresh_token_reused`. */
  nextRefreshError: string | null = null;
  /** Milliseconds a refresh takes, to widen races. */
  refreshDelayMs = 0;
  /** Overrides for the next ID token, to forge a bad one. */
  nextIdTokenOverrides: {
    nonce?: string;
    audience?: string;
    issuer?: string;
  } | null = null;
  revocationStatus = 200;

  models: Array<{ slug: string; display_name: string; visibility: string }> = [
    {
      slug: 'gpt-plan-large',
      display_name: 'GPT Plan Large',
      visibility: 'list',
    },
    { slug: 'gpt-internal', display_name: 'Internal', visibility: 'hide' },
    {
      slug: 'gpt-plan-small',
      display_name: 'GPT Plan Small',
      visibility: 'list',
    },
  ];

  private server!: Server;
  private baseUrl = '';
  private privateKey!: CryptoKey;
  private publicJwk!: Record<string, unknown>;
  private readonly codes = new Map<string, PendingCode>();
  private readonly grants: Grant[] = [];
  private counter = 0;

  async start(): Promise<void> {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    this.privateKey = privateKey as CryptoKey;
    this.publicJwk = {
      ...(await exportJWK(publicKey)),
      kid: 'fake-key',
      alg: 'RS256',
      use: 'sig',
    };

    this.server = createServer((req, res) => {
      void this.handle(req, res).catch((error) => {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: { message: String(error) } }));
      });
    });
    await new Promise<void>((resolve) =>
      this.server.listen(0, '127.0.0.1', resolve),
    );
    this.baseUrl = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}`;
  }

  async stop(): Promise<void> {
    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  get endpoints(): ChatgptSubscriptionEndpoints {
    return {
      authorizeUrl: `${this.baseUrl}/api/accounts/authorize`,
      tokenUrl: `${this.baseUrl}/api/accounts/oauth/token`,
      discoveryUrl: `${this.baseUrl}/.well-known/openid-configuration`,
      apiBaseUrl: `${this.baseUrl}/v1`,
    };
  }

  get issuer(): string {
    return this.baseUrl;
  }

  /** The access token currently valid for an account. */
  accessTokenFor(subject: string): string | undefined {
    return this.grants
      .filter((grant) => grant.subject === subject && !grant.revoked)
      .pop()?.accessToken;
  }

  /**
   * Plays the person approving (or refusing) at OpenAI. Takes the address Taico
   * would send the browser to and returns the address OpenAI would redirect to.
   */
  approve(
    authorizationUrl: string,
    account: { subject: string; email: string; scope?: string; deny?: boolean },
  ): string {
    const params = new URL(authorizationUrl).searchParams;
    const redirect = new URL(params.get('redirect_uri')!);
    redirect.searchParams.set('state', params.get('state')!);

    if (account.deny) {
      redirect.searchParams.set('error', 'access_denied');
      return redirect.toString();
    }

    const requestedClient = params.get('client_id')!;
    const isRegistration = requestedClient === 'dynamic_agent_client';
    const clientId = isRegistration
      ? `oaiapp_${randomUUID().slice(0, 8)}`
      : requestedClient;
    const code = `code-${++this.counter}`;
    this.codes.set(code, {
      clientId,
      redirectUri: params.get('redirect_uri')!,
      codeChallenge: params.get('code_challenge')!,
      nonce: params.get('nonce')!,
      subject: account.subject,
      email: account.email,
      scope: account.scope ?? params.get('scope')!,
    });

    redirect.searchParams.set('code', code);
    if (isRegistration) {
      redirect.searchParams.set('client_id', clientId);
    }
    return redirect.toString();
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? '/', this.baseUrl);
    const route = `${req.method} ${url.pathname}`;

    switch (route) {
      case 'GET /.well-known/openid-configuration':
        return this.json(res, 200, {
          issuer: this.baseUrl,
          jwks_uri: `${this.baseUrl}/jwks`,
          revocation_endpoint: `${this.baseUrl}/revoke`,
        });
      case 'GET /jwks':
        return this.json(res, 200, { keys: [this.publicJwk] });
      case 'POST /api/accounts/oauth/token':
        return this.token(res, await this.form(req));
      case 'POST /revoke': {
        const form = await this.form(req);
        this.revocations.push(form);
        if (this.revocationStatus !== 200) {
          return this.json(res, this.revocationStatus, {});
        }
        const grant = this.grants.find(
          (candidate) => candidate.refreshToken === form.token,
        );
        if (grant) {
          grant.revoked = true;
        }
        res.writeHead(200);
        res.end();
        return;
      }
      case 'GET /v1/models': {
        this.modelsRequests.push(req.headers.authorization);
        if (!this.grantFor(req.headers.authorization)) {
          return this.json(res, 401, {
            error: { code: 'invalid_token', message: 'bad token' },
          });
        }
        return this.json(res, 200, { models: this.models });
      }
      case 'POST /v1/responses':
        return this.responses(req, res);
      default:
        return this.json(res, 404, { error: { message: `no route ${route}` } });
    }
  }

  private async token(
    res: ServerResponse,
    form: Record<string, string>,
  ): Promise<void> {
    this.tokenRequests.push(form);

    if (form.resource !== `${this.baseUrl}/v1`) {
      return this.json(res, 400, { error: 'invalid_target' });
    }

    if (form.grant_type === 'authorization_code') {
      const pending = this.codes.get(form.code);
      this.codes.delete(form.code);
      const challenge = createHash('sha256')
        .update(form.code_verifier ?? '')
        .digest('base64url');
      if (
        !pending ||
        pending.clientId !== form.client_id ||
        pending.redirectUri !== form.redirect_uri ||
        pending.codeChallenge !== challenge
      ) {
        return this.json(res, 400, { error: 'invalid_grant' });
      }

      const grant: Grant = {
        clientId: pending.clientId,
        subject: pending.subject,
        email: pending.email,
        scope: pending.scope,
        accessToken: `at-${++this.counter}`,
        refreshToken: `rt-${++this.counter}`,
        revoked: false,
      };
      this.grants.push(grant);

      const overrides = this.nextIdTokenOverrides;
      this.nextIdTokenOverrides = null;
      const idToken = await new SignJWT({
        email: grant.email,
        nonce: overrides?.nonce ?? pending.nonce,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'fake-key' })
        .setIssuer(overrides?.issuer ?? this.baseUrl)
        .setAudience(overrides?.audience ?? grant.clientId)
        .setSubject(grant.subject)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(this.privateKey);

      return this.json(res, 200, {
        access_token: grant.accessToken,
        refresh_token: grant.refreshToken,
        id_token: idToken,
        scope: grant.scope,
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }

    if (form.grant_type === 'refresh_token') {
      if (this.refreshDelayMs) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.refreshDelayMs),
        );
      }
      const grant = this.grants.find(
        (candidate) =>
          candidate.refreshToken === form.refresh_token &&
          candidate.clientId === form.client_id,
      );
      if (this.nextRefreshError) {
        const error = this.nextRefreshError;
        this.nextRefreshError = null;
        if (error.startsWith('server')) {
          return this.json(res, 503, { error });
        }
        // Any other error means the grant is gone for good.
        if (grant) {
          grant.revoked = true;
        }
        return this.json(res, 400, { error });
      }
      if (!grant || grant.revoked) {
        // A refresh token that was already rotated away.
        return this.json(res, 400, { error: 'refresh_token_reused' });
      }
      grant.accessToken = `at-${++this.counter}`;
      grant.refreshToken = `rt-${++this.counter}`;
      return this.json(res, 200, {
        access_token: grant.accessToken,
        refresh_token: grant.refreshToken,
        scope: grant.scope,
        expires_in: 3600,
        token_type: 'Bearer',
      });
    }

    return this.json(res, 400, { error: 'unsupported_grant_type' });
  }

  private async responses(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const body = JSON.parse(await this.read(req)) as Record<string, any>;
    this.responsesRequests.push({
      authorization: req.headers.authorization,
      body,
    });

    if (!this.grantFor(req.headers.authorization)) {
      return this.json(res, 401, {
        error: {
          code: 'subscription_sharing_invalid_user',
          message: 'unknown token',
        },
      });
    }

    const scripted =
      this.script.shift() ?? textResponse('Hello from your plan');
    if ('status' in scripted) {
      res.writeHead(scripted.status, {
        'content-type': 'application/json',
        'x-request-id': 'req_fake',
      });
      res.end(JSON.stringify({ error: scripted.error }));
      return;
    }

    res.writeHead(200, { 'content-type': 'text/event-stream' });
    for (const event of scripted.events) {
      res.write(
        `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`,
      );
    }
    res.end();
  }

  private grantFor(authorization: string | undefined): Grant | undefined {
    return this.grants.find(
      (grant) =>
        !grant.revoked && authorization === `Bearer ${grant.accessToken}`,
    );
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  }

  private async form(req: IncomingMessage): Promise<Record<string, string>> {
    return Object.fromEntries(new URLSearchParams(await this.read(req)));
  }

  private read(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });
  }
}
