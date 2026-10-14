/**
 * Where Sign in with ChatGPT lives. Injected so tests can point the whole
 * flow at a fake OpenAI; production always uses the defaults below.
 */
export type ChatgptSubscriptionEndpoints = {
  authorizeUrl: string;
  tokenUrl: string;
  /** OpenID discovery document: issuer, signing keys and revocation endpoint. */
  discoveryUrl: string;
  /** Base of the public API. Inference goes to `<apiBaseUrl>/responses` and nowhere else. */
  apiBaseUrl: string;
};

export const CHATGPT_SUBSCRIPTION_ENDPOINTS = Symbol(
  'CHATGPT_SUBSCRIPTION_ENDPOINTS',
);

export const DEFAULT_CHATGPT_SUBSCRIPTION_ENDPOINTS: ChatgptSubscriptionEndpoints =
  {
    authorizeUrl: 'https://auth.openai.com/api/accounts/authorize',
    tokenUrl: 'https://auth.openai.com/api/accounts/oauth/token',
    discoveryUrl: 'https://auth.openai.com/.well-known/openid-configuration',
    apiBaseUrl: 'https://api.openai.com/v1',
  };

/** Shared client used only for a person's first sign-in; the callback issues their own. */
export const REGISTRATION_CLIENT_ID = 'dynamic_agent_client';

/** Shown on OpenAI's consent screen the first time. */
export const AGENT_NAME_HINT = 'Taico';

/** The scope that allows inference on the person's plan. Without it nothing is sent. */
export const PLAN_USAGE_SCOPE = 'chatgpt.tokens.use.direct';

export const AUTHORIZATION_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'resource.invoke',
  PLAN_USAGE_SCOPE,
].join(' ');

/** Path of the loopback redirect. Fixed by OpenAI; only the port may vary. */
export const LOOPBACK_CALLBACK_PATH = '/auth/callback';
export const LOOPBACK_HOST = '127.0.0.1';

/** Where the person sees and manages how much of their plan they have used. */
export const MANAGE_USAGE_URL = 'https://chatgpt.com/settings/usage';

/** Route of the Taico UI that finishes a sign-in. */
export const UI_CALLBACK_PATH = '/settings/models/chatgpt-callback';

export const AUTHORIZATION_ATTEMPT_TTL_MS = 10 * 60 * 1000;
