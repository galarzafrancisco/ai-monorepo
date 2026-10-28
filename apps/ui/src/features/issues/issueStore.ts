import { useEffect, useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import { IssueWireEvents, type IssueUpdatedWireEvent } from '@taico/events';
import { getUIWebSocketUrl } from '../../config/api';
import { IssuesService, type Issue } from './api';
import { issueKey, type IssueRef } from './issueLinks';

export type IssueEntry =
  | { status: 'loading' }
  | { status: 'ready'; issue: Issue }
  | { status: 'error' }
  /** Not on github.com or a GitHub Enterprise Taico has a connection to: shown as a plain link. */
  | { status: 'unsupported' };

/** The API takes at most this many per lookup. */
const LOOKUP_BATCH = 50;
/** Requests made in the same moment (one render of a board) share a lookup. */
const BATCH_DELAY_MS = 30;
/**
 * Issues still on screen are looked up again this often. A lookup counts as a
 * view, which keeps the backend polling them while they are shown.
 */
const REVIEW_INTERVAL_MS = 4 * 60 * 1000;

/**
 * One copy of every issue shown anywhere in the app, filled by batched REST
 * lookups and kept current by the `/issues` socket. Works like pullRequestStore.
 */
class IssueStore {
  private entries = new Map<string, IssueEntry>();
  private shown = new Map<string, number>();
  /** Keys this page has looked up. A seeded copy may never have been read from GitHub, or be stale. */
  private lookedUp = new Set<string>();
  private pending = new Set<string>();
  private listeners = new Set<() => void>();
  private timer: number | undefined;
  private socket: Socket | null = null;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get(key: string): IssueEntry | undefined {
    return this.entries.get(key);
  }

  /** Stores issues a page already fetched, so their chips need no lookup of their own. */
  seed(issues: Issue[]) {
    for (const issue of issues) {
      this.entries.set(issue.key, { status: 'ready', issue });
    }
    this.listeners.forEach((listener) => listener());
  }

  /** Marks an issue as on screen; returns the call that takes it off. */
  show(ref: IssueRef): () => void {
    const key = issueKey(ref);
    this.shown.set(key, (this.shown.get(key) ?? 0) + 1);
    if (!this.entries.has(key)) this.entries.set(key, { status: 'loading' });
    // Seeded copies are looked up too: the lookup reads issues never read
    // before, refreshes stale ones and counts as a view.
    if (!this.lookedUp.has(key)) this.queue(key);
    this.connect();
    return () => {
      const count = (this.shown.get(key) ?? 1) - 1;
      if (count <= 0) this.shown.delete(key);
      else this.shown.set(key, count);
    };
  }

  private queue(key: string) {
    this.lookedUp.add(key);
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
        const found = await IssuesService.IssuesController_lookup({ body: { refs: batch } });
        found.forEach((issue) => this.set(issue.key, { status: 'ready', issue }));
        // The answer leaves out issues on hosts Taico has no connection to.
        const answered = new Set(found.map((issue) => issue.key));
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

  private set(key: string, entry: IssueEntry) {
    this.entries.set(key, entry);
    this.listeners.forEach((listener) => listener());
  }

  /** Looks up everything on screen again: after a reconnect (events may have been missed) and now and then. */
  private reviewShown() {
    for (const key of this.shown.keys()) this.queue(key);
  }

  private connect() {
    if (this.socket) return;
    const socket = io(getUIWebSocketUrl('/issues'), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    let connectedBefore = false;
    socket.on('connect', () => {
      socket.emit('issues.subscribe', {});
      if (connectedBefore) this.reviewShown();
      connectedBefore = true;
    });
    socket.on(IssueWireEvents.ISSUE_UPDATED, (event: IssueUpdatedWireEvent) => {
      const key = event.issue.key;
      if (this.entries.has(key)) this.set(key, { status: 'ready', issue: event.issue as Issue });
    });
    this.socket = socket;
    window.setInterval(() => this.reviewShown(), REVIEW_INTERVAL_MS);
  }
}

export const issueStore = new IssueStore();

/** The state of an issue, fetched once and kept live while the component is mounted. */
export function useIssue(ref: IssueRef | null): IssueEntry | undefined {
  const key = ref ? issueKey(ref) : null;
  const host = ref?.host;
  const owner = ref?.owner;
  const repo = ref?.repo;
  const number = ref?.number;
  useEffect(() => {
    if (!owner || !repo || !number) return;
    return issueStore.show({ host, owner, repo, number });
  }, [host, owner, repo, number]);
  return useSyncExternalStore(issueStore.subscribe, () => (key ? issueStore.get(key) : undefined));
}
