import assert from 'node:assert/strict';
import { ApiClient, type RetryPolicy } from './generated/index.js';
import { BaseClient, ApiError } from './generated/base-client.js';

class RawClient extends BaseClient {
  send(body: ReadableStream) { return this.request('POST', '/raw', { body, bodyType: 'raw' }); }
}
const originalFetch = globalThis.fetch;
const originalTimeout = globalThis.setTimeout;
const delays: number[] = [];
let attempts = 0;
let statuses: number[] = [];
let retryAfter: string | undefined;
let cancelled = 0;
const config = { baseUrl: 'http://x/prefix' };
const client = new ApiClient(config);
function reset(next: number[], header?: string) {
  attempts = 0;
  statuses = [...next];
  delays.length = 0;
  cancelled = 0;
  retryAfter = header;
}
function get(retry?: RetryPolicy | false) {
  return client.users.UsersController_getUsers({ retry });
}
try {
  globalThis.setTimeout = ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
    delays.push(delay ?? 0);
    return originalTimeout(callback, 0, ...args);
  }) as typeof setTimeout;
  globalThis.fetch = async () => {
    attempts++;
    const status = statuses.shift() ?? 200;
    if (status === 200) return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
    return new Response(new ReadableStream({ cancel() { cancelled++; } }), {
      status, headers: retryAfter === undefined ? {} : { 'Retry-After': retryAfter },
    });
  };
  reset([429, 500, 502, 503, 200]);
  assert.deepEqual(await get(), []);
  assert.equal(attempts, 5);
  assert.equal(cancelled, 4);
  assert.deepEqual(delays, [1000, 2000, 4000, 8000]);

  // Final response still becomes the normal ApiError.
  reset([500, 500, 500, 500, 500]);
  // Use finite error bodies so parsing the final response completes.
  globalThis.fetch = async () => {
    attempts++;
    return new Response('{"message":"unavailable"}', { status: 503, headers: { 'Content-Type': 'application/json' } });
  };
  await assert.rejects(get(), (error: unknown) => error instanceof ApiError && error.message === 'unavailable');
  assert.equal(attempts, 5);

  const respond = async () => {
    attempts++;
    return new Response('[]', { status: statuses.shift() ?? 200, headers: {
      'Content-Type': 'application/json', ...(retryAfter === undefined ? {} : { 'Retry-After': retryAfter }),
    } });
  };
  globalThis.fetch = respond;
  reset([500]);
  await assert.rejects(get(false), ApiError);
  assert.equal(attempts, 1);
  assert.deepEqual(delays, []);
  reset([500, 500, 200]);
  const configured = new ApiClient({ ...config, retry: { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 15 } });
  await configured.users.UsersController_getUsers({ retry: { initialDelayMs: 12 } });
  assert.deepEqual(delays, [12, 15]);
  reset([500, 200]);
  const disabled = new ApiClient({ ...config, retry: false });
  await assert.rejects(disabled.users.UsersController_getUsers(), ApiError);
  assert.equal(attempts, 1);
  reset([500, 200]);
  await disabled.users.UsersController_getUsers({ retry: { initialDelayMs: 0 } });
  assert.equal(attempts, 2);
  reset([500, 200]);
  await assert.rejects(get({ maxAttempts: 1 }), ApiError);
  assert.equal(attempts, 1);

  for (const status of [400, 401, 403, 404, 422]) {
    reset([status]);
    await assert.rejects(get(), ApiError);
    assert.equal(attempts, 1);
  }
  reset([429, 200], '3');
  await get();
  assert.deepEqual(delays, [3000]);
  reset([503, 200], new Date(Date.now() + 10000).toUTCString());
  await get();
  assert(delays[0]! >= 8500 && delays[0]! <= 10000);
  reset([500, 200], 'invalid');
  await get();
  assert.deepEqual(delays, [1000]);
  reset([500, 200]);
  await assert.rejects(get({ maxAttempts: 0 }), RangeError);
  assert.equal(attempts, 0);

  // Abort cancels the backoff without another fetch.
  globalThis.setTimeout = originalTimeout;
  reset([503, 200]);
  const controller = new AbortController();
  const pending = client.users.UsersController_getUsers({ signal: controller.signal });
  originalTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(attempts, 1);
  reset([200]);
  await assert.rejects(client.users.UsersController_getUsers({ signal: controller.signal }), { name: 'AbortError' });
  assert.equal(attempts, 0);

  // Network errors are propagated rather than retrying arbitrary failed writes.
  const networkError = new TypeError('network failed');
  attempts = 0;
  globalThis.fetch = async () => { attempts++; throw networkError; };
  await assert.rejects(get(), error => error === networkError);
  assert.equal(attempts, 1);

  // JSON writes keep the same body and HTTP method across retries.
  attempts = 0;
  const bodies: unknown[] = [];
  globalThis.fetch = async (_url, init) => {
    attempts++;
    assert.equal(init?.method, 'POST');
    bodies.push(init?.body);
    return new Response('{"id":"1"}', { status: attempts === 1 ? 500 : 201,
      headers: { 'Content-Type': 'application/json' } });
  };
  await client.users.UsersController_createUser({
    body: { name: 'Example', email: 'example@example.com' }, retry: { initialDelayMs: 0 },
  });
  assert.equal(attempts, 2);
  assert.deepEqual(bodies, [JSON.stringify({ name: 'Example', email: 'example@example.com' }),
    JSON.stringify({ name: 'Example', email: 'example@example.com' })]);

  // Request streams are never replayed, even on a retryable status.
  attempts = 0;
  globalThis.fetch = async () => { attempts++; return new Response('', { status: 503 }); };
  await assert.rejects(new RawClient(config).send(new ReadableStream({ start(c) { c.close(); } })), ApiError);
  assert.equal(attempts, 1);

  // Stream retries apply before events are consumed, using per-call policy.
  attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return attempts === 1 ? new Response('', { status: 503 })
      : new Response('data: {"index":1}\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
  };
  const events = [];
  for await (const event of client.stream.StreamController_streamEvents({ retry: { initialDelayMs: 0 } })) events.push(event);
  assert.deepEqual(events, [{ index: 1 }]);
  assert.equal(attempts, 2);
  attempts = 0;
  globalThis.fetch = async () => { attempts++; return new Response('', { status: 503 }); };
  await assert.rejects(async () => {
    for await (const _event of client.stream.StreamController_streamEvents({ retry: false })) {}
  }, ApiError);
  assert.equal(attempts, 1);
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalTimeout;
}
console.log('✅ Retry defaults, overrides, backoff, Retry-After, cancellation, and stream connections');
