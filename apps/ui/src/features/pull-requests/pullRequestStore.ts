import { useEffect, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { PullRequestWireEvents, type PullRequestUpdatedWireEvent } from '@taico/events';
import { getUIWebSocketUrl } from '../../config/api';
import { PullRequestsService, type PullRequest } from './api';
import { pullRequestKey, type PullRequestRef } from './pullRequestLinks';

export type PullRequestEntry =
  | { status: 'loading' }
  | { status: 'ready'; pullRequest: PullRequest }
  | { status: 'error' }
  /** Not on github.com or a GitHub Enterprise Taico has a connection to: shown as a plain link. */
  | { status: 'unsupported' };

/** The API takes at most this many per lookup. */
const LOOKUP_BATCH = 50;
/** Requests made in the same moment (one render of a board) share a lookup. */
const BATCH_DELAY_MS = 30;
/**
 * Pull requests still on screen are looked up again this often. A lookup
 * counts as a view, which keeps the backend polling them while they are shown.
 */
const REVIEW_INTERVAL_MS = 4 * 60 * 1000;

/**
 * One copy of every pull request shown anywhere in the app, filled by batched
 * REST lookups and kept current by the `/pull-requests` socket.
 */
class PullRequestStore {
  private entries = new Map<string, PullRequestEntry>();
  private refs = new Map<string, PullRequestRef>();
  private shown = new Map<string, number>();
  private pending = new Set<string>();
  private listeners = new Set<() => void>();
  private timer: number | undefined;
  private reviewTimer: number | undefined;
  private socket: Socket | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get(key: string): PullRequestEntry | undefined {
    return this.entries.get(key);
  }

  /** Stores pull requests a page already fetched, so their chips need no lookup of their own. */
  seed(pullRequests: PullRequest[]) {
    for (const pullRequest of pullRequests) {
      this.entries.set(pullRequest.key, { status: 'ready', pullRequest });
    }
    this.listeners.forEach((listener) => listener());
  }

  /** Marks a pull request as on screen; returns the call that takes it off. */
  show(ref: PullRequestRef): () => void {
    const key = pullRequestKey(ref);
    this.refs.set(key, ref);
    this.shown.set(key, (this.shown.get(key) ?? 0) + 1);
    if (!this.entries.has(key)) {
      this.entries.set(key, { status: 'loading' });
      this.queue(key);
    }
    this.connect();
    return () => {
      const count = (this.shown.get(key) ?? 1) - 1;
      if (count <= 0) this.shown.delete(key);
      else this.shown.set(key, count);
    };
  }

  private queue(key: string) {
    this.pending.add(key);
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.flush(), BATCH_DELAY_MS);
  }

  private async flush() {
    const keys = [...this.pending];
    this.pending.clear();
    for (let start = 0; start < keys.length; start += LOOKUP_BATCH) {
      const batch = keys.slice(start, start + LOOKUP_BATCH);
      try {
        const found = await PullRequestsService.PullRequestsController_lookup({ body: { refs: batch } });
        found.forEach((pullRequest) => this.set(pullRequest.key, { status: 'ready', pullRequest }));
        // The answer leaves out pull requests on hosts Taico has no connection to.
        const answered = new Set(found.map((pullRequest) => pullRequest.key));
        for (const key of batch) {
          if (!answered.has(key)) this.set(key, { status: 'unsupported' });
        }
      } catch {
        for (const key of batch) {
          if (this.entries.get(key)?.status !== 'ready') this.set(key, { status: 'error' });
        }
      }
    }
  }

  private set(key: string, entry: PullRequestEntry) {
    this.entries.set(key, entry);
    this.listeners.forEach((listener) => listener());
  }

  /** Looks up everything on screen again: after a reconnect (events may have been missed) and now and then. */
  private reviewShown() {
    for (const key of this.shown.keys()) this.queue(key);
  }

  private connect() {
    if (this.socket) return;
    const socket = io(getUIWebSocketUrl('/pull-requests'), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    let connectedBefore = false;
    socket.on('connect', () => {
      socket.emit('pull_requests.subscribe', {});
      if (connectedBefore) this.reviewShown();
      connectedBefore = true;
    });
    socket.on(PullRequestWireEvents.PULL_REQUEST_UPDATED, (event: PullRequestUpdatedWireEvent) => {
      const key = event.pullRequest.key;
      if (this.entries.has(key)) this.set(key, { status: 'ready', pullRequest: event.pullRequest as PullRequest });
    });
    this.socket = socket;
    this.reviewTimer = window.setInterval(() => this.reviewShown(), REVIEW_INTERVAL_MS);
  }
}

export const pullRequestStore = new PullRequestStore();

/** The state of a pull request, fetched once and kept live while the component is mounted. */
export function usePullRequest(ref: PullRequestRef | null): PullRequestEntry | undefined {
  const key = ref ? pullRequestKey(ref) : null;
  const host = ref?.host;
  const owner = ref?.owner;
  const repo = ref?.repo;
  const number = ref?.number;
  useEffect(() => {
    if (!owner || !repo || !number) return;
    return pullRequestStore.show({ host, owner, repo, number });
  }, [host, owner, repo, number]);
  return useSyncExternalStore(pullRequestStore.subscribe, () => (key ? pullRequestStore.get(key) : undefined));
}
