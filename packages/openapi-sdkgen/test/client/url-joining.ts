import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BaseClient } from './generated/base-client.js';
import { parseOpenAPISpec } from '../../src/parser.js';

const source = readFileSync(new URL('./generated/base-client.ts', import.meta.url), 'utf8');
assert(!source.includes('new URL(path, this.config.baseUrl)'));
assert.equal(source.match(/this\.config\.baseUrl\.replace/g)?.length, 2);

// Every generated operation must supply an absolute path to the joining code.
const spec = JSON.parse(readFileSync(new URL('../api/openapi.json', import.meta.url), 'utf8'));
for (const resource of parseOpenAPISpec(spec).resources) {
  for (const operation of resource.operations) assert(operation.path.startsWith('/'));
}

class TestClient extends BaseClient {
  get() { return this.request('GET', '/api/messages', { params: { limit: 2 } }); }
  events() { return this.streamEvents('/api/events', { params: { count: 1 } }); }
}

const originalFetch = globalThis.fetch;
try {
  for (const [baseUrl, prefix] of [
    ['http://x/prefix', '/prefix'],
    ['http://x/prefix/', '/prefix'],
    ['http://x/prefix///', '/prefix'],
    ['http://x', ''],
    ['http://x/', ''],
  ]) {
    const urls: string[] = [];
    globalThis.fetch = async (input) => {
      const url = String(input);
      urls.push(url);
      return new Response(url.includes('/api/events') ? 'data: {"id":1}\n\n' : '{"ok":true}', {
        headers: { 'Content-Type': url.includes('/api/events') ? 'text/event-stream' : 'application/json' },
      });
    };
    const client = new TestClient({ baseUrl });
    assert.deepEqual(await client.get(), { ok: true });
    const events = [];
    for await (const event of client.events()) events.push(event);
    assert.deepEqual(events, [{ id: 1 }]);
    assert.deepEqual(urls, [`http://x${prefix}/api/messages?limit=2`, `http://x${prefix}/api/events?count=1`]);
    for (const url of urls) assert(!new URL(url).pathname.includes('//'));
  }
} finally {
  globalThis.fetch = originalFetch;
}
console.log('✅ Requests and streams preserve URL prefixes and query parameters');
