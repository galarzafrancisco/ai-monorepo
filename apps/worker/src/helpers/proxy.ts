import { HttpsProxyAgent } from 'https-proxy-agent';
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici';

type Env = Record<string, string | undefined>;

/** The proxy configured for HTTPS (or plain HTTP) traffic, if any. */
function configuredProxy(env: Env): string | undefined {
  return (
    env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || undefined
  )?.trim() || undefined;
}

/**
 * Whether `NO_PROXY` exempts `url`'s host: `*`, an exact host, or a domain
 * suffix (`example.com` and `.example.com` both match `api.example.com`).
 */
export function bypassesProxy(url: string, env: Env = process.env): boolean {
  const list = (env.NO_PROXY || env.no_proxy || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  if (list.includes('*')) return true;
  const host = new URL(url).hostname.toLowerCase();
  return list.some((entry) => {
    const name = entry.replace(/^\*?\./, '').replace(/:\d+$/, '');
    return host === name || host.endsWith(`.${name}`);
  });
}

/** The proxy to reach `url` through, honouring `NO_PROXY`; undefined for a direct connection. */
export function proxyFor(url: string, env: Env = process.env): string | undefined {
  const proxy = configuredProxy(env);
  return proxy && !bypassesProxy(url, env) ? proxy : undefined;
}

/**
 * Makes the worker's own fetch calls honour HTTPS_PROXY, HTTP_PROXY and
 * NO_PROXY (Node's built-in fetch ignores them). Returns whether a proxy is set.
 */
export function installFetchProxy(env: Env = process.env): boolean {
  if (!configuredProxy(env)) return false;
  setGlobalDispatcher(new EnvHttpProxyAgent());
  return true;
}

/**
 * An agent for the worker's socket to `url` when it must go through a proxy.
 * The `ws` library underneath socket.io ignores proxy settings otherwise, so
 * a worker behind a proxy could never hold its real-time connection.
 */
export function socketProxyAgent(url: string, env: Env = process.env): HttpsProxyAgent<string> | undefined {
  const proxy = proxyFor(url, env);
  return proxy ? new HttpsProxyAgent(proxy) : undefined;
}
