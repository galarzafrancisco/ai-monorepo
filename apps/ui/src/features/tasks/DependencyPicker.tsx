import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { TaskSearchResultDto } from '@taico/client/v2';
import { Search } from 'lucide-react';
import { Avatar, Modal } from '../../ui/primitives';
import { elapsedTime } from '../../shared/helpers/elapsedTime';
import { TasksService } from './api';
import { TASKS_STATUS } from './const';
import { blockedDependencyIds, idPrefixFromQuery, projectName, suggestDependencies } from './dependencySuggestions';
import type { Task } from './types';
import './DependencyPicker.css';

/** Recent tasks fetched to suggest from, and to fill in search results. */
const POOL_SIZE = 100;
const SEARCH_LIMIT = 20;
const RELATED_LIMIT = 6;
const RECENT_LIMIT = 10;

type Row = {
  id: string;
  /** Full task when we have it; search hits outside the pool fill in as they load. */
  task: Task | null;
  name: string;
  status: Task['status'] | null;
  reasons: string[];
  match: Pick<TaskSearchResultDto, 'matchedOn' | 'excerpt' | 'commentAuthor'> | null;
};

type Section = { title: string; rows: Row[] };

/**
 * Picks a task for `task` to depend on. Before you type it suggests related
 * and recent tasks; typing searches titles, descriptions and comments (or a
 * #id). Each row shows enough to tell similar tasks apart.
 */
export function DependencyPicker({
  task,
  onPick,
  onClose,
}: {
  task: Task;
  /** Resolves true when the dependency was added, which closes the picker. */
  onPick: (dependency: Task) => Promise<boolean>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [pool, setPool] = useState<Map<string, Task>>(new Map());
  const [poolState, setPoolState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hits, setHits] = useState<TaskSearchResultDto[]>([]);
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'done' | 'error'>('idle');
  const [highlighted, setHighlighted] = useState(0);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRequest = useRef(0);
  /** Hits we've already tried to fetch, so a failed one isn't retried on every render. */
  const requestedIds = useRef(new Set<string>());

  const addToPool = useCallback((tasks: Task[]) => {
    setPool((previous) => {
      const next = new Map(previous);
      for (const item of tasks) next.set(item.id, item);
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    TasksService.TasksController_listTasks({ page: 1, limit: POOL_SIZE })
      .then((response) => {
        if (cancelled) return;
        addToPool(response.items);
        setPoolState('ready');
      })
      .catch(() => { if (!cancelled) setPoolState('error'); });
    return () => { cancelled = true; };
  }, [addToPool]);

  const trimmed = query.trim();

  useEffect(() => {
    const requestId = ++searchRequest.current;
    if (!trimmed) {
      setHits([]);
      setSearchState('idle');
      return;
    }
    setSearchState('searching');
    const timeout = window.setTimeout(async () => {
      try {
        // A #id can belong to any task, not just the loaded ones, and the search index has no ids.
        const prefix = idPrefixFromQuery(trimmed);
        const [results, idMatches] = await Promise.all([
          TasksService.TasksController_searchTasks({ query: trimmed, limit: SEARCH_LIMIT }),
          prefix
            ? TasksService.TasksController_listTasks({ idPrefix: prefix, limit: SEARCH_LIMIT }).then((response) => response.items).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (searchRequest.current !== requestId) return;
        addToPool(idMatches);
        setHits(results ?? []);
        setSearchState('done');
      } catch {
        if (searchRequest.current !== requestId) return;
        setHits([]);
        setSearchState('error');
      }
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [trimmed, addToPool]);

  // Search hits outside the pool: fetch them so their rows show assignee and project too.
  useEffect(() => {
    const missing = hits.map((hit) => hit.id).filter((id) => !pool.has(id) && !requestedIds.current.has(id));
    if (missing.length === 0) return;
    for (const id of missing) requestedIds.current.add(id);
    Promise.all(missing.map((id) => TasksService.TasksController_getTask({ id }).catch(() => null)))
      .then((tasks) => addToPool(tasks.filter((item): item is Task => item !== null)));
  }, [hits, pool, addToPool]);

  const sections = useMemo<Section[]>(() => {
    const poolTasks = [...pool.values()];
    const toRow = (item: Task, reasons: string[] = []): Row => ({
      id: item.id, task: item, name: item.name, status: item.status, reasons, match: null,
    });

    if (!trimmed) {
      const { related, recent } = suggestDependencies(task, poolTasks);
      return [
        { title: 'Related', rows: related.slice(0, RELATED_LIMIT).map((item) => toRow(item.task, item.reasons)) },
        { title: 'Recently updated', rows: recent.slice(0, RECENT_LIMIT).map((item) => toRow(item.task)) },
      ].filter((section) => section.rows.length > 0);
    }

    const blocked = blockedDependencyIds(task, poolTasks);
    const prefix = idPrefixFromQuery(trimmed);
    const idMatches = prefix
      ? poolTasks.filter((item) => item.id.toLowerCase().startsWith(prefix) && !blocked.has(item.id)).map((item) => toRow(item))
      : [];
    const idMatchIds = new Set(idMatches.map((row) => row.id));
    const searchRows = hits
      .filter((hit) => !blocked.has(hit.id) && !idMatchIds.has(hit.id))
      .map((hit): Row => {
        const known = pool.get(hit.id) ?? null;
        return {
          id: hit.id,
          task: known,
          name: known?.name ?? hit.name,
          status: known?.status ?? (hit.status as Task['status'] | null),
          reasons: [],
          match: { matchedOn: hit.matchedOn, excerpt: hit.excerpt, commentAuthor: hit.commentAuthor },
        };
      });
    return [
      { title: 'Matching id', rows: idMatches },
      { title: 'Results', rows: searchRows },
    ].filter((section) => section.rows.length > 0);
  }, [pool, trimmed, hits, task]);

  const rows = useMemo(() => sections.flatMap((section) => section.rows), [sections]);

  useEffect(() => { setHighlighted(0); }, [trimmed]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row-index="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const pick = async (row: Row) => {
    if (pickingId) return;
    setPickingId(row.id);
    try {
      const full = row.task ?? await TasksService.TasksController_getTask({ id: row.id });
      if (await onPick(full)) onClose();
    } catch {
      // onPick reports its own errors; stay open so another task can be picked.
    } finally {
      setPickingId(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' && rows.length > 0) {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp' && rows.length > 0) {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[highlighted];
      if (row) void pick(row);
    }
  };

  const emptyMessage = trimmed
    ? searchState === 'searching' ? 'Searching…'
      : searchState === 'error' ? "Couldn't search tasks. Try again."
      : 'No tasks match. Try other words, or a #id.'
    : poolState === 'loading' ? 'Loading tasks…'
      : poolState === 'error' ? "Couldn't load tasks. Type to search instead."
      : 'No other tasks yet.';

  let rowIndex = -1;

  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }} title="Add dependency" className="dependency-picker">
      <p className="dependency-picker__lede">
        <strong>{task.name}</strong> will wait on the task you pick.
      </p>
      <label className="dependency-picker__search">
        <Search size={16} aria-hidden="true" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search titles, descriptions, comments or #id"
          aria-label="Search tasks"
          aria-controls="dependency-picker-list"
          aria-activedescendant={rows[highlighted] ? `dependency-option-${rows[highlighted].id}` : undefined}
        />
      </label>
      <div id="dependency-picker-list" className="dependency-picker__list" ref={listRef} role="listbox" aria-label="Tasks">
        {rows.length === 0 ? (
          <p className="dependency-picker__empty">{emptyMessage}</p>
        ) : sections.map((section) => (
          <div key={section.title} role="group" aria-label={section.title}>
            <div className="dependency-picker__section">{section.title}</div>
            {section.rows.map((row) => {
              rowIndex += 1;
              const index = rowIndex;
              return (
                <DependencyOption
                  key={row.id}
                  row={row}
                  index={index}
                  query={trimmed}
                  highlighted={index === highlighted}
                  busy={pickingId === row.id}
                  disabled={pickingId !== null}
                  onHover={() => setHighlighted(index)}
                  onPick={() => void pick(row)}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="dependency-picker__hint" aria-hidden="true">
        <kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to add · <kbd>Esc</kbd> to close
      </p>
    </Modal>
  );
}

function DependencyOption({ row, index, query, highlighted, busy, disabled, onHover, onPick }: {
  row: Row;
  index: number;
  query: string;
  highlighted: boolean;
  busy: boolean;
  disabled: boolean;
  onHover: () => void;
  onPick: () => void;
}) {
  const status = row.status ? TASKS_STATUS[row.status] : null;
  const StatusIcon = status?.icon;
  const assignee = row.task?.assigneeActor ?? null;
  const project = row.task ? projectName(row.task) : null;
  const matchLabel = row.match?.matchedOn === 'comment'
    ? `Comment${row.match.commentAuthor ? ` by ${row.match.commentAuthor}` : ''}`
    : row.match?.matchedOn === 'content' ? 'Description' : null;

  return (
    <button
      type="button"
      id={`dependency-option-${row.id}`}
      role="option"
      aria-selected={highlighted}
      data-row-index={index}
      className={`dependency-option${highlighted ? ' dependency-option--highlighted' : ''}`}
      onMouseMove={onHover}
      onClick={onPick}
      disabled={disabled}
    >
      <span className={`dependency-option__status dependency-option__status--${row.status ?? 'unknown'}`} title={status?.label}>
        {StatusIcon ? <StatusIcon size={15} aria-hidden="true" /> : null}
      </span>
      <span className="dependency-option__main">
        <span className="dependency-option__title">
          <span className="dependency-option__name">{highlight(row.name, query)}</span>
          <span className="dependency-option__id">#{row.id.slice(0, 6)}</span>
        </span>
        <span className="dependency-option__meta">
          {status && <span>{status.label}</span>}
          {assignee ? (
            <span className="dependency-option__person">
              <Avatar size="xs" name={assignee.displayName} src={assignee.avatarUrl || undefined} />
              {assignee.displayName}
            </span>
          ) : row.task ? <span>Unassigned</span> : null}
          {project && <span>{project}</span>}
          {row.task && <span>updated {elapsedTime(row.task.updatedAt)}</span>}
          {row.reasons.map((reason) => <span key={reason} className="dependency-option__reason">{reason}</span>)}
        </span>
        {matchLabel && row.match?.excerpt ? (
          <span className="dependency-option__excerpt">
            <span className="dependency-option__excerpt-label">{matchLabel}:</span> {highlight(row.match.excerpt, query)}
          </span>
        ) : null}
      </span>
      {busy && <span className="dependency-option__busy">Adding…</span>}
    </button>
  );
}

/** Marks the first case-insensitive occurrence of each typed word. */
function highlight(text: string, query: string): ReactNode {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 1 && !word.startsWith('#'));
  if (words.length === 0) return text;
  const lower = text.toLowerCase();
  const ranges = words
    .map((word) => [lower.indexOf(word), word.length] as const)
    .filter(([start]) => start >= 0)
    .sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const [start, length] of ranges) {
    if (start < cursor) continue;
    parts.push(text.slice(cursor, start), <mark key={start}>{text.slice(start, start + length)}</mark>);
    cursor = start + length;
  }
  parts.push(text.slice(cursor));
  return parts;
}
