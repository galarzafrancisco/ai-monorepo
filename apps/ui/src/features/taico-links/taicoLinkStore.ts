import { useEffect, useSyncExternalStore } from 'react';
import { io } from 'socket.io-client';
import { TaskWireEvents } from '@taico/events';
import { getUIWebSocketUrl } from '../../config/api';
import { TasksService } from '../tasks/api';
import { ContextService } from '../context/api';
import type { TaskStatus } from '../../shared/const/taskStatus';
import { taicoLinkKey, type TaicoLinkKind, type TaicoLinkRef } from './taicoLinks';

export type TaicoLinkEntry =
  | { status: 'loading' }
  | { status: 'ready'; title: string; taskStatus?: TaskStatus }
  /** Deleted, never existed, or not visible to this person. */
  | { status: 'error' };

type Label = { title: string; taskStatus?: TaskStatus };

/** The bits of a socket.io client the store uses. */
export interface TaicoLinkSocket {
  on(event: string, handler: (event: any) => void): unknown;
  emit(event: string, payload: unknown): unknown;
  close(): unknown;
}

export interface TaicoLinkStoreDeps {
  fetchTask(id: string): Promise<Label>;
  fetchBlock(id: string): Promise<Label>;
  /** Opens the socket that tells us when tasks (or blocks) change. */
  connect(kind: TaicoLinkKind): TaicoLinkSocket;
  now(): number;
}

/**
 * A label older than this is looked up again when a chip showing it mounts,
 * in case an event was missed. Socket events keep shown labels current in between.
 */
export const TAICO_LINK_FRESH_MS = 60 * 1000;

const TASK_CHANGE_EVENTS = [
  TaskWireEvents.TASK_UPDATED,
  TaskWireEvents.TASK_STATUS_CHANGED,
  TaskWireEvents.TASK_ASSIGNED,
] as const;
const BLOCK_UPDATED = 'context.block.updated';
const BLOCK_DELETED = 'context.block.deleted';

type Stored = { entry: TaicoLinkEntry; fetchedAt: number };

/**
 * The names (and, for tasks, the statuses) of the tasks and blocks linked to
 * on screen.
 *
 * - Labels belong to whoever is signed in: `setIdentity` drops them all (and
 *   any lookup still in flight) when that changes, so one account never sees
 *   another's titles.
 * - Socket events only say *that* something changed. The label is then looked
 *   up again over REST, so what a person sees is always what they may read.
 */
export class TaicoLinkStore {
  private entries = new Map<string, Stored>();
  private refs = new Map<string, TaicoLinkRef>();
  private shown = new Map<string, number>();
  /** The latest lookup per key; older answers are ignored. */
  private requests = new Map<string, number>();
  private nextRequest = 0;
  private listeners = new Set<() => void>();
  private sockets = new Map<TaicoLinkKind, TaicoLinkSocket>();
  /** `undefined` until auth has said who is signed in. */
  private identity: string | null | undefined = undefined;

  constructor(private readonly deps: TaicoLinkStoreDeps) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get(key: string): TaicoLinkEntry | undefined {
    return this.entries.get(key)?.entry;
  }

  /**
   * Who is signed in (`null` when nobody is). A change throws away every
   * label, closes the sockets, and looks up what is on screen again as the
   * new person.
   */
  setIdentity(identity: string | null) {
    if (identity === this.identity) return;
    this.identity = identity;
    this.entries.clear();
    this.requests.clear();
    this.sockets.forEach((socket) => socket.close());
    this.sockets.clear();
    if (identity !== null) {
      for (const key of this.shown.keys()) this.fetch(key);
    }
    this.notify();
  }

  /** Marks a task or block as on screen; returns the call that takes it off. */
  show(ref: TaicoLinkRef): () => void {
    const key = taicoLinkKey(ref);
    this.refs.set(key, ref);
    this.shown.set(key, (this.shown.get(key) ?? 0) + 1);
    const stored = this.entries.get(key);
    const stale =
      !stored ||
      (stored.entry.status !== 'loading' &&
        (stored.entry.status === 'error' || this.deps.now() - stored.fetchedAt > TAICO_LINK_FRESH_MS));
    if (stale && this.identity !== null) this.fetch(key);
    this.connect(ref.kind);
    return () => {
      const count = (this.shown.get(key) ?? 1) - 1;
      if (count <= 0) this.shown.delete(key);
      else this.shown.set(key, count);
    };
  }

  private fetch(key: string) {
    const ref = this.refs.get(key);
    if (!ref) return;
    const request = ++this.nextRequest;
    this.requests.set(key, request);
    // Keep showing the old label while it is looked up again.
    if (!this.entries.has(key)) this.entries.set(key, { entry: { status: 'loading' }, fetchedAt: 0 });
    const lookup = ref.kind === 'task' ? this.deps.fetchTask(ref.id) : this.deps.fetchBlock(ref.id);
    void lookup.then(
      (label) => this.settle(key, request, { status: 'ready', ...label }),
      () => this.settle(key, request, { status: 'error' }),
    );
  }

  private settle(key: string, request: number, entry: TaicoLinkEntry) {
    // Superseded by a newer lookup, or asked for by someone no longer signed in.
    if (this.requests.get(key) !== request) return;
    this.requests.delete(key);
    this.entries.set(key, { entry, fetchedAt: this.deps.now() });
    this.notify();
  }

  /** Something changed: look it up again if we hold a label for it. */
  private changed(kind: TaicoLinkKind, id: string | undefined) {
    if (!id) return;
    const key = taicoLinkKey({ kind, id });
    if (this.entries.has(key)) this.fetch(key);
  }

  private removed(kind: TaicoLinkKind, id: string | undefined) {
    if (!id) return;
    const key = taicoLinkKey({ kind, id });
    if (!this.entries.has(key)) return;
    this.requests.delete(key);
    this.entries.set(key, { entry: { status: 'error' }, fetchedAt: this.deps.now() });
    this.notify();
  }

  /** After a reconnect events may have been missed, so everything held of that kind is looked up again. */
  private refreshKind(kind: TaicoLinkKind) {
    for (const [key, ref] of this.refs) {
      if (ref.kind === kind && this.entries.has(key)) this.fetch(key);
    }
  }

  private connect(kind: TaicoLinkKind) {
    if (this.identity === null || this.sockets.has(kind)) return;
    const socket = this.deps.connect(kind);
    let connectedBefore = false;
    if (kind === 'task') {
      socket.on('connect', () => {
        socket.emit('tasks.subscribe', {});
        if (connectedBefore) this.refreshKind('task');
        connectedBefore = true;
      });
      for (const event of TASK_CHANGE_EVENTS) {
        socket.on(event, (wire: { payload?: { id?: string } }) => this.changed('task', wire?.payload?.id));
      }
      socket.on(TaskWireEvents.TASK_DELETED, (wire: { payload?: { taskId?: string } }) =>
        this.removed('task', wire?.payload?.taskId),
      );
    } else {
      socket.on('connect', () => {
        socket.emit('context.subscribe', {});
        if (connectedBefore) this.refreshKind('block');
        connectedBefore = true;
      });
      socket.on(BLOCK_UPDATED, (wire: { payload?: { id?: string } }) => this.changed('block', wire?.payload?.id));
      socket.on(BLOCK_DELETED, (wire: { payload?: { blockId?: string } }) =>
        this.removed('block', wire?.payload?.blockId),
      );
    }
    this.sockets.set(kind, socket);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const taicoLinkStore = new TaicoLinkStore({
  fetchTask: async (id) => {
    const task = await TasksService.TasksController_getTask({ id });
    return { title: task.name, taskStatus: task.status as TaskStatus };
  },
  fetchBlock: async (id) => {
    const block = await ContextService.ContextController_getBlock({ id });
    return { title: block.title };
  },
  connect: (kind) =>
    io(getUIWebSocketUrl(kind === 'task' ? '/tasks' : '/context'), {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    }),
  now: () => Date.now(),
});

/** The name of a linked task or block, kept current while the component is mounted. */
export function useTaicoLink(ref: TaicoLinkRef | null): TaicoLinkEntry | undefined {
  const kind = ref?.kind;
  const id = ref?.id;
  useEffect(() => {
    if (!kind || !id) return;
    return taicoLinkStore.show({ kind, id });
  }, [kind, id]);
  return useSyncExternalStore(taicoLinkStore.subscribe, () =>
    kind && id ? taicoLinkStore.get(taicoLinkKey({ kind, id })) : undefined,
  );
}
