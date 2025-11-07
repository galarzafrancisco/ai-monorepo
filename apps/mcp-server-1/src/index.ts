import express, { NextFunction, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';
import { OAuthClientInformationFullSchema } from '@modelcontextprotocol/sdk/shared/auth.js';
import { z } from 'zod';

type IntrospectionResponse = {
  active?: boolean;
  scope?: string;
  client_id?: string;
  exp?: number;
  resource?: string;
  [key: string]: unknown;
};

const PORT = Number.parseInt(process.env.PORT ?? '4001', 10);
const BASE_URL = new URL(
  process.env.MCP_BASE_URL ?? `http://localhost:${PORT}`,
);
const AUTH_SERVER_URL = new URL(
  process.env.AUTH_SERVER_URL ?? 'http://localhost:3000',
);
const MCP_ROUTE = process.env.MCP_ROUTE ?? '/mcp';
const DEFAULT_AUTH_SERVER_METADATA_URL = new URL(
  '/.well-known/oauth-authorization-server',
  BASE_URL,
);
const AUTH_SERVER_METADATA_URL =
  // Ensure the protected resource metadata advertises this server's
  // authorization metadata endpoint unless overridden explicitly.
  (() => {
    const override = process.env.AUTH_SERVER_ISSUER;
    if (!override) {
      return DEFAULT_AUTH_SERVER_METADATA_URL;
    }

    try {
      return new URL(override);
    } catch {
      return DEFAULT_AUTH_SERVER_METADATA_URL;
    }
  })();

const AUTH_PATHS = {
  authorize:
    process.env.AUTH_SERVER_AUTHORIZATION_PATH ?? '/oauth2/v1/authorize',
  token: process.env.AUTH_SERVER_TOKEN_PATH ?? '/oauth2/v1/token',
  revoke: process.env.AUTH_SERVER_REVOCATION_PATH ?? '/oauth2/v1/revoke',
  register:
    process.env.AUTH_SERVER_REGISTRATION_PATH ?? '/oauth2/v1/register',
  introspect:
    process.env.AUTH_SERVER_INTROSPECTION_PATH ?? '/oauth2/v1/introspect',
  clientInfo:
    process.env.AUTH_SERVER_CLIENT_INFO_PATH ?? '/oauth2/v1/clients/',
};

const buildEndpointUrl = (path: string): string => {
  const targetPath = path.startsWith('/') ? path : `/${path}`;
  return new URL(targetPath, AUTH_SERVER_URL).toString();
};

const sanitizeHeaderValue = (value: string): string =>
  value.replace(/"/g, `'`);

const sendUnauthorized = (
  res: Response,
  description: string,
  headerDescription: string = description,
) => {
  const headerSafeDescription = sanitizeHeaderValue(headerDescription);
  res.setHeader(
    'WWW-Authenticate',
    `Bearer realm="model-context-protocol", error="invalid_token", error_description="${headerSafeDescription}"`,
  );
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  res.status(401).json({
    error: 'invalid_token',
    error_description: description,
  });
};

const proxyProvider = new ProxyOAuthServerProvider({
  endpoints: {
    authorizationUrl: buildEndpointUrl(AUTH_PATHS.authorize),
    tokenUrl: buildEndpointUrl(AUTH_PATHS.token),
    revocationUrl: AUTH_PATHS.revoke
      ? buildEndpointUrl(AUTH_PATHS.revoke)
      : undefined,
    registrationUrl: AUTH_PATHS.register
      ? buildEndpointUrl(AUTH_PATHS.register)
      : undefined,
  },
  verifyAccessToken: async (token) => {
    const body = new URLSearchParams({ token }).toString();
    const response = await fetch(buildEndpointUrl(AUTH_PATHS.introspect), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Failed to introspect access token. status=${response.status}`,
      );
    }

    const payload = (await response.json()) as IntrospectionResponse;
    if (!payload.active) {
      throw new Error('Access token is not active');
    }

    let resourceUrl: URL | undefined;
    if (typeof payload.resource === 'string') {
      try {
        resourceUrl = new URL(payload.resource);
      } catch {
        resourceUrl = undefined;
      }
    }

    return {
      token,
      clientId: payload.client_id ?? 'unknown-client',
      scopes:
        typeof payload.scope === 'string'
          ? payload.scope.split(/\s+/).filter(Boolean)
          : [],
      expiresAt:
        typeof payload.exp === 'number' ? Number(payload.exp) : undefined,
      resource: resourceUrl,
      extra: payload,
    };
  },
  getClient: async (clientId) => {
    const basePath = AUTH_PATHS.clientInfo.endsWith('/')
      ? AUTH_PATHS.clientInfo
      : `${AUTH_PATHS.clientInfo}/`;
    const clientUrl = new URL(`${basePath}${encodeURIComponent(clientId)}`, AUTH_SERVER_URL);
    const response = await fetch(clientUrl.toString());

    if (response.status === 404) {
      return undefined;
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch client ${clientId}. status=${response.status}`,
      );
    }

    const raw = await response.json();
    return OAuthClientInformationFullSchema.parse({
      ...raw,
      client_id: raw.client_id ?? clientId,
      redirect_uris:
        Array.isArray(raw.redirect_uris) && raw.redirect_uris.length > 0
          ? raw.redirect_uris
          : [new URL('/oauth/callback', BASE_URL).toString()],
    });
  },
});

const app = express();

app.use(
  mcpAuthRouter({
    provider: proxyProvider,
    issuerUrl: new URL(`http://localhost:5001/mcp/foo:bar/0.0.0`),
    baseUrl: BASE_URL,
    resourceServerUrl: BASE_URL,
    serviceDocumentationUrl: new URL(
      process.env.MCP_SERVICE_DOCS_URL ??
        'https://modelcontextprotocol.io/specification/latest',
    ),
    scopesSupported: (process.env.MCP_SUPPORTED_SCOPES ?? '')
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean),
    resourceName: process.env.MCP_RESOURCE_NAME ?? 'mcp-server-1',
  }),
);

app.use(express.json({ limit: '1mb' }));

const bearerAuth: express.RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.header('authorization');
  if (!authHeader) {
    sendUnauthorized(res, 'Bearer token required');
    return;
  }

  const [scheme, token] = authHeader.split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    sendUnauthorized(res, 'Malformed authorization header');
    return;
  }

  try {
    const authInfo = await proxyProvider.verifyAccessToken(token);
    res.locals.accessToken = token;
    res.locals.authInfo = authInfo;
    next();
  } catch (error) {
    sendUnauthorized(
      res,
      error instanceof Error ? error.message : 'Invalid access token',
      'Invalid or expired access token',
    );
  }
};

const server = new McpServer({
  name: 'mcp-server-1',
  version: process.env.npm_package_version ?? '0.0.1',
});

server.registerTool(
  'ping',
  {
    title: 'Ping',
    description: 'Echoes the provided message with a timestamp',
    inputSchema: {
      message: z.string().default('ping'),
    },
  },
  async ({ message }) => {
    const text = `pong: ${message} @ ${new Date().toISOString()}`;
    return {
      content: [{ type: 'text', text }],
      structuredContent: { message: text },
    };
  },
);

app.all(MCP_ROUTE, bearerAuth, async (req, res, next) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.once('close', () => {
    void transport.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    await transport.close().catch(() => {
      /* ignore */
    });
    next(error);
    return;
  }

  await transport.close().catch(() => {
    /* ignore */
  });
});

app.use(
  (
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    // Return errors in a spec-compliant way for MCP clients.
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({
        error: 'internal_server_error',
        error_description: error.message,
      });
    }
  },
);

app.listen(PORT, () => {
  const endpointUrl = new URL(
    MCP_ROUTE.startsWith('/') ? MCP_ROUTE : `/${MCP_ROUTE}`,
    BASE_URL,
  );
  console.log(
    `MCP server listening on ${BASE_URL.toString()} (endpoint ${endpointUrl.toString()})`,
  );
});
