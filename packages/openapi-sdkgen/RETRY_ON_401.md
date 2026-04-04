# Retry On 401

## Goal

Allow generated SDK clients to recover automatically from expired bearer tokens without forcing every caller to wrap requests in ad hoc retry logic.

This is especially useful for long-lived CLI or worker processes that hold OAuth access tokens and refresh tokens locally.

## Proposed Client Config

Extend generated `ClientConfig` with an optional retry policy for bearer auth:

```ts
type ClientConfig = {
  baseUrl: string;
  getAccessToken?: () => string | Promise<string>;
  getCookies?: () => string | Promise<string>;
  credentials?: 'include' | 'same-origin' | 'omit';
  headers?: Record<string, string>;
  retryOn401?: boolean;
  refreshAccessToken?: () => Promise<string | void>;
};
```

## Intended Behavior

When `retryOn401` is enabled and a request receives HTTP `401`:

1. call `refreshAccessToken()`
2. rebuild auth headers
3. retry the request once

If refresh fails, or the retried request still returns `401`, surface the error.

## Why This Belongs In The SDK

Without this, every consumer that uses expiring bearer tokens needs its own:

- token invalidation
- refresh coordination
- one-time retry logic
- duplicated HTTP status inspection

That logic is transport-level behavior, so it fits better in the generated base client than in every caller.

## Non-Goals

- automatic retry on all `403` responses
- multi-retry backoff policies
- websocket token refresh
- cookie-session refresh flows

`403` should remain opt-in or separately designed, because it often means valid credentials with insufficient permissions rather than token expiry.

## Worker Use Case

For a worker process, the intended flow would be:

```ts
const auth = new WorkerAuth({ ... });

const client = new ApiClient({
  baseUrl,
  getAccessToken: () => auth.getAccessToken(),
  retryOn401: true,
  refreshAccessToken: async () => {
    await auth.refreshAccessToken();
  },
});
```

`WorkerAuth.getAccessToken()` can remain proactive and refresh before expiry, while the SDK handles the fallback case where a token is rejected by the server anyway.

## Open Questions

- Should retry apply only when `getAccessToken` is configured?
- Should refresh be serialized inside the client, or delegated to the auth provider?
- Should the base client throw a structured HTTP error type instead of generic `Error` first?
- Should streaming requests use the same retry behavior or fail fast?
