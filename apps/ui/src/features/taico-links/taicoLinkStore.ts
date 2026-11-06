import { useEffect, useSyncExternalStore } from 'react';
import { TasksService } from '../tasks/api';
import { ContextService } from '../context/api';
import type { TaskStatus } from '../../shared/const/taskStatus';
import { taicoLinkKey, type TaicoLinkRef } from './taicoLinks';

export type TaicoLinkEntry =
  | { status: 'loading' }
  | { status: 'ready'; title: string; taskStatus?: TaskStatus }
  /** Deleted, never existed, or not visible to this person. */
  | { status: 'error' };

/**
 * The names (and, for tasks, the statuses) of the tasks and blocks linked to
 * on screen. Each is looked up once per page load: a chip only needs a label.
 */
class TaicoLinkStore {
  private entries = new Map<string, TaicoLinkEntry>();
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get(key: string): TaicoLinkEntry | undefined {
    return this.entries.get(key);
  }

  load(ref: TaicoLinkRef) {
    const key = taicoLinkKey(ref);
    if (this.entries.has(key)) return;
    this.entries.set(key, { status: 'loading' });
    void this.fetch(ref).then(
      (entry) => this.set(key, entry),
      () => this.set(key, { status: 'error' }),
    );
  }

  private async fetch(ref: TaicoLinkRef): Promise<TaicoLinkEntry> {
    if (ref.kind === 'task') {
      const task = await TasksService.TasksController_getTask({ id: ref.id });
      return { status: 'ready', title: task.name, taskStatus: task.status as TaskStatus };
    }
    const block = await ContextService.ContextController_getBlock({ id: ref.id });
    return { status: 'ready', title: block.title };
  }

  private set(key: string, entry: TaicoLinkEntry) {
    this.entries.set(key, entry);
    this.listeners.forEach((listener) => listener());
  }
}

export const taicoLinkStore = new TaicoLinkStore();

/** The name of a linked task or block, looked up when first shown. */
export function useTaicoLink(ref: TaicoLinkRef | null): TaicoLinkEntry | undefined {
  const kind = ref?.kind;
  const id = ref?.id;
  useEffect(() => {
    if (kind && id) taicoLinkStore.load({ kind, id });
  }, [kind, id]);
  return useSyncExternalStore(taicoLinkStore.subscribe, () =>
    kind && id ? taicoLinkStore.get(taicoLinkKey({ kind, id })) : undefined,
  );
}
