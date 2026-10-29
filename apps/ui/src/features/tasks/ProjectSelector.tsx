import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Search } from 'lucide-react';
import { Modal } from '../../ui/primitives';
import { elapsedTime } from '../../shared/helpers/elapsedTime';
import { ProjectsService } from '../projects/api';
import { toRepoLink } from '../projects/repoLink';
import type { Project } from '../projects/types';
import { hitsForQuery, initialHighlightIndex, isCurrentProjectChoice } from './projectPicker';
import { activityByProjectTag, matchesClearProject, projectSections, type ProjectSection } from './projectSuggestions';
import { recentProjectIdsForPicker, rememberRecentProject } from './recentProjects';
import './ProjectSelector.css';

const CLEAR_ID = '__no_project__';
const SEARCH_LIMIT = 20;

type Row =
  | { kind: 'clear'; id: typeof CLEAR_ID }
  | { kind: 'project'; id: string; project: Project; reasons: string[] };

type TaskActivity = {
  tags: { name: string }[];
  updatedAt: string;
};

/**
 * Picks the project a task belongs to. Before you type it lists recent
 * projects; typing searches slug, description and repo, with the server's
 * fuzzy search filling in typos the local ranker misses.
 */
export function ProjectSelector({
  taskName,
  projects,
  projectsState,
  selectedProjectId,
  hasProjectTag,
  tasks,
  onPick,
  onClose,
}: {
  taskName: string;
  projects: Project[];
  projectsState: 'loading' | 'ready' | 'error';
  selectedProjectId: string | null;
  /** True when the task has a project:* tag, including one the loaded list does not resolve. */
  hasProjectTag: boolean;
  tasks: TaskActivity[];
  onPick: (project: Project | null) => Promise<boolean>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [serverSearch, setServerSearch] = useState<{ query: string; hits: Project[] }>({ query: '', hits: [] });
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'done' | 'error'>('idle');
  const [highlighted, setHighlighted] = useState(0);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRequest = useRef(0);
  const rememberedIds = useMemo(() => recentProjectIdsForPicker(), []);

  const trimmed = query.trim();

  useEffect(() => {
    const requestId = ++searchRequest.current;
    if (!trimmed) {
      setServerSearch({ query: '', hits: [] });
      setSearchState('idle');
      return;
    }
    setSearchState('searching');
    const timeout = window.setTimeout(async () => {
      try {
        const hits = await ProjectsService.ProjectsController_searchProjects({ q: trimmed, limit: SEARCH_LIMIT });
        if (searchRequest.current !== requestId) return;
        setServerSearch({ query: trimmed, hits: hits ?? [] });
        setSearchState('done');
      } catch {
        if (searchRequest.current !== requestId) return;
        setServerSearch({ query: trimmed, hits: [] });
        setSearchState('error');
      }
    }, 200);
    return () => window.clearTimeout(timeout);
  }, [trimmed]);

  const activity = useMemo(() => activityByProjectTag(tasks), [tasks]);
  const known = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const hits = useMemo(
    () => hitsForQuery(trimmed, serverSearch).map((hit) => known.get(hit.id) ?? hit),
    [trimmed, serverSearch, known],
  );

  const sections = useMemo(
    () => projectSections(projects, trimmed, rememberedIds, activity, hits),
    [projects, trimmed, rememberedIds, activity, hits],
  );

  const rows = useMemo<Row[]>(() => {
    const projectRows: Row[] = sections.flatMap((section) => section.projects.map((project) => ({
      kind: 'project' as const,
      id: project.id,
      project: project as Project,
      reasons: [
        ...(project.id === selectedProjectId ? ['Current'] : []),
        ...(rememberedIds.includes(project.id) && trimmed ? ['Recent'] : []),
      ],
    })));
    const clear: Row[] = projectsState === 'ready' && matchesClearProject(trimmed)
      ? [{ kind: 'clear', id: CLEAR_ID }]
      : [];
    // Keep "No project" off the default Enter target. It leads only when the query is a clear-word.
    return trimmed ? [...clear, ...projectRows] : [...projectRows, ...clear];
  }, [sections, selectedProjectId, rememberedIds, trimmed, projectsState]);

  const moved = useRef(false);
  useEffect(() => { moved.current = false; }, [trimmed]);

  useEffect(() => {
    if (moved.current) {
      setHighlighted((index) => Math.min(index, Math.max(rows.length - 1, 0)));
      return;
    }
    setHighlighted(initialHighlightIndex(rows, trimmed, selectedProjectId));
  }, [trimmed, rows, selectedProjectId]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row-index="${highlighted}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  const pick = async (row: Row) => {
    if (pickingId) return;
    const project = row.kind === 'clear' ? null : row.project;
    const choice = row.kind === 'clear' ? { kind: 'clear' as const } : { kind: 'project' as const, id: row.id };
    if (isCurrentProjectChoice(choice, selectedProjectId, hasProjectTag)) {
      onClose();
      return;
    }
    setPickingId(row.id);
    try {
      if (await onPick(project)) {
        if (project) rememberRecentProject(project.id);
        onClose();
      }
    } catch {
      // onPick reports its own errors; stay open so another project can be picked.
    } finally {
      setPickingId(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' && rows.length > 0) {
      event.preventDefault();
      moved.current = true;
      setHighlighted((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp' && rows.length > 0) {
      event.preventDefault();
      moved.current = true;
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[highlighted];
      if (row) void pick(row);
    }
  };

  const emptyMessage = trimmed
    ? searchState === 'searching' ? 'Searching…'
      : searchState === 'error' ? "Couldn't search projects. Try again."
      : 'No projects match. Try other words.'
    : projectsState === 'loading' ? 'Loading projects…'
      : projectsState === 'error' ? "Couldn't load projects."
      : 'No projects yet.';

  const showEmpty = rows.length === 0;
  const groups = groupedRows(rows, sections);

  return (
    <Modal open onOpenChange={(open) => { if (!open) onClose(); }} title="Set project" className="project-selector">
      <p className="project-selector__lede">
        Move <strong>{taskName}</strong> to a project, or clear it.
      </p>
      <label className="project-selector__search">
        <Search size={16} aria-hidden="true" />
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search name, description or repo"
          aria-label="Search projects"
          aria-controls="project-selector-list"
          aria-activedescendant={rows[highlighted] ? `project-option-${rows[highlighted].id}` : undefined}
        />
      </label>
      <div id="project-selector-list" className="project-selector__list" ref={listRef} role="listbox" aria-label="Projects">
        {showEmpty ? (
          <p className="project-selector__empty">{emptyMessage}</p>
        ) : groups.map((group) => (
          <div key={group.key} className={group.key === 'clear' && groups[0]?.key !== 'clear' ? 'project-selector__group--end' : undefined} role="group" aria-label={group.title ?? 'No project'}>
            {group.title ? <div className="project-selector__section">{group.title}</div> : null}
            {group.rows.map(({ row, index }) => (
              <ProjectOption
                key={row.id}
                row={row}
                index={index}
                query={trimmed}
                highlighted={index === highlighted}
                current={isCurrentProjectChoice(
                  row.kind === 'clear' ? { kind: 'clear' } : { kind: 'project', id: row.id },
                  selectedProjectId,
                  hasProjectTag,
                )}
                busy={pickingId === row.id}
                disabled={pickingId !== null}
                activityAt={row.kind === 'project' ? activity.get(row.project.tagName) : undefined}
                onHover={() => { moved.current = true; setHighlighted(index); }}
                onPick={() => void pick(row)}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="project-selector__hint" aria-hidden="true">
        <kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to set · <kbd>Esc</kbd> to close
      </p>
    </Modal>
  );
}

function groupedRows(rows: Row[], sections: ProjectSection[]): { key: string; title: string | null; rows: { row: Row; index: number }[] }[] {
  const byId = new Map(rows.map((row, index) => [row.id, { row, index }]));
  const groups: { key: string; title: string | null; rows: { row: Row; index: number }[] }[] = [];
  const clear = byId.get(CLEAR_ID);
  const clearFirst = rows[0]?.kind === 'clear';
  if (clear && clearFirst) groups.push({ key: 'clear', title: null, rows: [clear] });
  sections.forEach((section, sectionIndex) => {
    const sectionRows = section.projects
      .map((project) => byId.get(project.id))
      .filter((item): item is { row: Row; index: number } => item !== undefined);
    if (sectionRows.length > 0) groups.push({ key: `${section.title}-${sectionIndex}`, title: section.title, rows: sectionRows });
  });
  if (clear && !clearFirst) groups.push({ key: 'clear', title: null, rows: [clear] });
  return groups;
}

function ProjectOption({
  row,
  index,
  query,
  highlighted,
  current,
  busy,
  disabled,
  activityAt,
  onHover,
  onPick,
}: {
  row: Row;
  index: number;
  query: string;
  highlighted: boolean;
  current: boolean;
  busy: boolean;
  disabled: boolean;
  activityAt?: number;
  onHover: () => void;
  onPick: () => void;
}) {
  const project = row.kind === 'project' ? row.project : null;
  const repo = project ? toRepoLink(project.repoUrl) : null;
  const reasons = row.kind === 'project' ? row.reasons : [];

  return (
    <button
      type="button"
      id={`project-option-${row.id}`}
      role="option"
      aria-selected={highlighted}
      data-row-index={index}
      className={`project-option${highlighted ? ' project-option--highlighted' : ''}`}
      onMouseMove={onHover}
      onClick={onPick}
      disabled={disabled}
    >
      <span
        className={`project-option__swatch${project ? '' : ' project-option__swatch--empty'}`}
        style={project?.tagColor ? { background: project.tagColor } : undefined}
        aria-hidden="true"
      />
      <span className="project-option__main">
        <span className="project-option__title">
          <span className="project-option__name">
            {project ? highlight(project.slug, query) : 'No project'}
          </span>
        </span>
        {project?.description ? (
          <span className="project-option__excerpt">{highlight(project.description, query)}</span>
        ) : null}
        {project && (repo || activityAt || reasons.length > 0) ? (
          <span className="project-option__meta">
            {repo ? <span>{highlight(repo.label, query)}</span> : null}
            {activityAt ? <span>active {elapsedTime(new Date(activityAt).toISOString())}</span> : null}
            {reasons.map((reason) => <span key={reason} className="project-option__reason">{reason}</span>)}
          </span>
        ) : null}
      </span>
      {current && !busy ? <Check className="project-option__check" size={16} aria-label="Current project" /> : null}
      {busy ? <span className="project-option__busy">Saving…</span> : null}
    </button>
  );
}

function highlight(text: string, query: string): ReactNode {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 1);
  if (words.length === 0 || !text) return text;
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
