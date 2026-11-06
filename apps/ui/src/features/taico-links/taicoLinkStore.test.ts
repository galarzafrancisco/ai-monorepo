// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { TAICO_LINK_FRESH_MS, TaicoLinkStore, type TaicoLinkSocket } from './taicoLinkStore';
import { taicoLinkKey, type TaicoLinkKind } from './taicoLinks';

type Label = { title: string; taskStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'FOR_REVIEW' | 'DONE' };

class FakeSocket implements TaicoLinkSocket {
  handlers = new Map<string, ((event: any) => void)[]>();
  closed = false;
  on(event: string, handler: (event: any) => void) {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
  }
  emit() {}
  close() {
    this.closed = true;
  }
  fire(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup() {
  let clock = 0;
  const sockets: Record<TaicoLinkKind, FakeSocket[]> = { task: [], block: [] };
  const fetchTask = vi.fn<[string], Promise<Label>>();
  const fetchBlock = vi.fn<[string], Promise<Label>>();
  const store = new TaicoLinkStore({
    fetchTask,
    fetchBlock,
    connect: (kind) => {
      const socket = new FakeSocket();
      sockets[kind].push(socket);
      return socket;
    },
    now: () => clock,
  });
  return {
    store,
    fetchTask,
    fetchBlock,
    sockets,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const taskKey = taicoLinkKey({ kind: 'task', id: 't1' });
const blockKey = taicoLinkKey({ kind: 'block', id: 'b1' });

describe('TaicoLinkStore', () => {
  it("drops one account's labels when another signs in", async () => {
    const { store, fetchTask } = setup();
    store.setIdentity('user-a');
    fetchTask.mockResolvedValueOnce({ title: 'Secret plan', taskStatus: 'IN_PROGRESS' });
    const hide = store.show({ kind: 'task', id: 't1' });
    await flush();
    expect(store.get(taskKey)).toEqual({ status: 'ready', title: 'Secret plan', taskStatus: 'IN_PROGRESS' });
    hide();

    store.setIdentity(null);
    expect(store.get(taskKey)).toBeUndefined();
    store.setIdentity('user-b');

    // B may not read it: B sees an error, never A's title.
    fetchTask.mockRejectedValueOnce(new Error('403'));
    store.show({ kind: 'task', id: 't1' });
    expect(store.get(taskKey)).toEqual({ status: 'loading' });
    await flush();
    expect(store.get(taskKey)).toEqual({ status: 'error' });
  });

  it("ignores a lookup made for the previous account that answers late", async () => {
    const { store, fetchTask } = setup();
    store.setIdentity('user-a');
    const late = deferred<Label>();
    fetchTask.mockReturnValueOnce(late.promise);
    store.show({ kind: 'task', id: 't1' });

    // Still on screen when the account changes: looked up again as B.
    const forB = deferred<Label>();
    fetchTask.mockReturnValueOnce(forB.promise);
    store.setIdentity('user-b');
    expect(fetchTask).toHaveBeenCalledTimes(2);

    late.resolve({ title: "A's title" });
    await flush();
    expect(store.get(taskKey)).toEqual({ status: 'loading' });

    forB.reject(new Error('403'));
    await flush();
    expect(store.get(taskKey)).toEqual({ status: 'error' });
  });

  it('closes sockets opened for the previous account', () => {
    const { store, fetchTask, sockets } = setup();
    fetchTask.mockResolvedValue({ title: 'x' });
    store.setIdentity('user-a');
    store.show({ kind: 'task', id: 't1' });
    expect(sockets.task).toHaveLength(1);
    store.setIdentity('user-b');
    expect(sockets.task[0].closed).toBe(true);
    store.show({ kind: 'task', id: 't1' });
    expect(sockets.task).toHaveLength(2);
  });

  it('looks a failed lookup up again the next time it is shown', async () => {
    const { store, fetchTask } = setup();
    store.setIdentity('user-a');
    fetchTask.mockRejectedValueOnce(new Error('403'));
    store.show({ kind: 'task', id: 't1' })();
    await flush();
    expect(store.get(taskKey)).toEqual({ status: 'error' });

    fetchTask.mockResolvedValueOnce({ title: 'Now shared' });
    store.show({ kind: 'task', id: 't1' });
    await flush();
    expect(store.get(taskKey)).toEqual({ status: 'ready', title: 'Now shared' });
  });

  it('updates a task status and name when the task changes', async () => {
    const { store, fetchTask, sockets } = setup();
    store.setIdentity('user-a');
    fetchTask.mockResolvedValueOnce({ title: 'Ship it', taskStatus: 'FOR_REVIEW' });
    store.show({ kind: 'task', id: 't1' });
    await flush();

    fetchTask.mockResolvedValueOnce({ title: 'Ship it now', taskStatus: 'DONE' });
    sockets.task[0].fire('task.status_changed', { payload: { id: 't1' } });
    // The old label stays while it is looked up again.
    expect(store.get(taskKey)).toEqual({ status: 'ready', title: 'Ship it', taskStatus: 'FOR_REVIEW' });
    await flush();
    expect(store.get(taskKey)).toEqual({ status: 'ready', title: 'Ship it now', taskStatus: 'DONE' });

    // Events about tasks nobody is showing are ignored.
    sockets.task[0].fire('task.updated', { payload: { id: 'other' } });
    expect(fetchTask).toHaveBeenCalledTimes(2);
  });

  it('renames and deletes blocks from socket events', async () => {
    const { store, fetchBlock, sockets } = setup();
    store.setIdentity('user-a');
    fetchBlock.mockResolvedValueOnce({ title: 'Notes' });
    store.show({ kind: 'block', id: 'b1' });
    await flush();

    fetchBlock.mockResolvedValueOnce({ title: 'Renamed notes' });
    sockets.block[0].fire('context.block.updated', { payload: { id: 'b1' } });
    await flush();
    expect(store.get(blockKey)).toEqual({ status: 'ready', title: 'Renamed notes' });

    sockets.block[0].fire('context.block.deleted', { payload: { blockId: 'b1' } });
    expect(store.get(blockKey)).toEqual({ status: 'error' });
  });

  it('looks everything up again after a reconnect', async () => {
    const { store, fetchTask, sockets } = setup();
    store.setIdentity('user-a');
    fetchTask.mockResolvedValue({ title: 'x' });
    store.show({ kind: 'task', id: 't1' });
    await flush();
    sockets.task[0].fire('connect');
    expect(fetchTask).toHaveBeenCalledTimes(1);
    sockets.task[0].fire('connect');
    expect(fetchTask).toHaveBeenCalledTimes(2);
  });

  it('looks up a stale label again when shown', async () => {
    const { store, fetchTask, advance } = setup();
    store.setIdentity('user-a');
    fetchTask.mockResolvedValue({ title: 'x' });
    store.show({ kind: 'task', id: 't1' })();
    await flush();
    store.show({ kind: 'task', id: 't1' })();
    expect(fetchTask).toHaveBeenCalledTimes(1);
    advance(TAICO_LINK_FRESH_MS + 1);
    store.show({ kind: 'task', id: 't1' });
    expect(fetchTask).toHaveBeenCalledTimes(2);
  });

  it('looks nothing up while nobody is signed in', () => {
    const { store, fetchTask, sockets } = setup();
    store.setIdentity(null);
    store.show({ kind: 'task', id: 't1' });
    expect(fetchTask).not.toHaveBeenCalled();
    expect(sockets.task).toHaveLength(0);
  });
});
