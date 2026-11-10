import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bypassesProxy, proxyFor, socketProxyAgent } from './proxy.js';

describe('worker proxy settings', () => {
  const env = { HTTPS_PROXY: 'http://proxy.local:3128', NO_PROXY: 'localhost,127.0.0.1,.internal.example,corp.example' };

  it('uses the proxy for other hosts', () => {
    assert.equal(proxyFor('https://live.taico.app/api', env), 'http://proxy.local:3128');
    assert.ok(socketProxyAgent('https://live.taico.app/executions/worker', env));
  });

  it('goes direct for hosts NO_PROXY lists, exactly or by domain', () => {
    assert.equal(proxyFor('http://localhost:2000', env), undefined);
    assert.equal(proxyFor('http://127.0.0.1:2000', env), undefined);
    assert.equal(proxyFor('https://api.internal.example', env), undefined);
    assert.equal(proxyFor('https://corp.example', env), undefined);
    assert.equal(proxyFor('https://app.corp.example', env), undefined);
    assert.equal(socketProxyAgent('http://localhost:2000/executions/worker', env), undefined);
  });

  it('does nothing without a proxy, and bypasses everything for NO_PROXY=*', () => {
    assert.equal(proxyFor('https://live.taico.app', {}), undefined);
    assert.equal(bypassesProxy('https://live.taico.app', { NO_PROXY: '*' }), true);
    assert.equal(proxyFor('https://live.taico.app', { https_proxy: 'http://p:1' }), 'http://p:1');
  });
});
