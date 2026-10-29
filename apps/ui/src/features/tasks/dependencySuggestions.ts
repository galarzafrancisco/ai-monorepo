import { TaskStatus } from './const';
import type { Task } from './types';

const PROJECT_TAG_PREFIX = 'project:';

export type DependencySuggestion = {
  task: Task;
  /** Why it's suggested, e.g. "Same project". Empty for plain recent tasks. */
  reasons: string[];
};

/**
 * Tasks that can't become dependencies of `task`: itself, ones it already
 * depends on, and ones that already depend on it (directly or through other
 * tasks we know about), since adding those would make a cycle.
 */
export function blockedDependencyIds(task: Task, pool: Task[]): Set<string> {
  const blocked = new Set<string>([task.id, ...(task.dependsOnIds ?? [])]);
  const dependents = new Map<string, string[]>();
  for (const candidate of pool) {
    for (const depId of candidate.dependsOnIds ?? []) {
      dependents.set(depId, [...(dependents.get(depId) ?? []), candidate.id]);
    }
  }
  const queue = [task.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const dependent of dependents.get(id) ?? []) {
      if (!blocked.has(dependent)) {
        blocked.add(dependent);
        queue.push(dependent);
      }
    }
  }
  return blocked;
}

/**
 * Ranks `pool` for the dependency picker before anything is typed. Related
 * tasks (same project, same assignee, shared tags) come first; the rest are
 * ordered by most recently updated. Shipped tasks sink below open ones.
 */
export function suggestDependencies(task: Task, pool: Task[]): { related: DependencySuggestion[]; recent: DependencySuggestion[] } {
  const blocked = blockedDependencyIds(task, pool);
  const projectTags = new Set(task.tags.filter((tag) => tag.name.startsWith(PROJECT_TAG_PREFIX)).map((tag) => tag.name));
  const otherTags = new Set(task.tags.filter((tag) => !tag.name.startsWith(PROJECT_TAG_PREFIX)).map((tag) => tag.name));
  const assigneeId = task.assigneeActor?.id ?? null;

  const scored = pool
    .filter((candidate) => !blocked.has(candidate.id))
    .map((candidate) => {
      const reasons: string[] = [];
      let score = 0;
      if (candidate.tags.some((tag) => projectTags.has(tag.name))) {
        reasons.push('Same project');
        score += 3;
      }
      const sharedTags = candidate.tags.filter((tag) => otherTags.has(tag.name)).map((tag) => tag.name);
      if (sharedTags.length > 0) {
        reasons.push(sharedTags.length === 1 ? `Tag ${sharedTags[0]}` : `${sharedTags.length} shared tags`);
        score += sharedTags.length;
      }
      if (assigneeId && candidate.assigneeActor?.id === assigneeId) {
        reasons.push('Same assignee');
        score += 1;
      }
      return { task: candidate, reasons, score, updated: Date.parse(candidate.updatedAt) || 0 };
    });

  const isOpen = (candidate: Task) => candidate.status !== TaskStatus.DONE;
  const byRelevance = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    Number(isOpen(b.task)) - Number(isOpen(a.task)) || b.score - a.score || b.updated - a.updated;
  const byRecency = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    Number(isOpen(b.task)) - Number(isOpen(a.task)) || b.updated - a.updated;

  const related = scored.filter((item) => item.score > 0).sort(byRelevance);
  const relatedIds = new Set(related.map((item) => item.task.id));
  const recent = scored.filter((item) => !relatedIds.has(item.task.id)).sort(byRecency);

  const strip = ({ task: suggestion, reasons }: (typeof scored)[number]) => ({ task: suggestion, reasons });
  return { related: related.map(strip), recent: recent.map(strip) };
}

/** A typed "#abc123" or "abc123" that looks like the start of a task id. */
export function idPrefixFromQuery(query: string): string | null {
  const match = /^#?([0-9a-f]{4,})$/i.exec(query.trim());
  return match ? match[1].toLowerCase() : null;
}

export function projectName(task: Task): string | null {
  const names = task.tags
    .filter((candidate) => candidate.name.startsWith(PROJECT_TAG_PREFIX))
    .map((tag) => tag.name.slice(PROJECT_TAG_PREFIX.length));
  return names.length > 0 ? names.join(', ') : null;
}
