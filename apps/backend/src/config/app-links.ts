/**
 * Links to pages of the Taico web app, for API responses and MCP tool results.
 *
 * The issuer URL is the address people open Taico at: in production the
 * backend serves the UI on it, and in development Vite serves the UI on it and
 * proxies the API. Agents get these links so they never have to guess one.
 *
 * Keep the paths in step with apps/ui/src/shared/taicoLinks.ts.
 */

import { getConfig } from './env.config';

/** The app's base address, without a trailing slash. */
export function appBaseUrl(): string {
  return getConfig().issuerUrl.replace(/\/+$/, '');
}

/** The page of a task in the web app. */
export function taskUrl(taskId: string): string {
  return `${appBaseUrl()}/tasks/task/${encodeURIComponent(taskId)}`;
}

/** The page of a context block in the web app. */
export function contextBlockUrl(blockId: string): string {
  return `${appBaseUrl()}/context/block/${encodeURIComponent(blockId)}`;
}

/** The same task, with its `url` placed right after its id. */
export function withTaskUrl<T extends { id: string }>(task: T): T & { url: string } {
  const { id, ...rest } = task;
  return { id, url: taskUrl(id), ...rest } as T & { url: string };
}

/** The same block, with its `url` placed right after its id. */
export function withContextBlockUrl<T extends { id: string }>(block: T): T & { url: string } {
  const { id, ...rest } = block;
  return { id, url: contextBlockUrl(id), ...rest } as T & { url: string };
}

/** A block tree with a `url` on every block in it. */
export function withContextBlockTreeUrls<T extends { id: string; children: T[] }>(
  node: T,
): T & { url: string } {
  return {
    ...withContextBlockUrl(node),
    children: node.children.map((child) => withContextBlockTreeUrls(child)),
  };
}
