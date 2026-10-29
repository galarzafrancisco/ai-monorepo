/**
 * Search hits belong to the query that produced them. A newer query must not
 * offer the previous response while the next search is still in flight —
 * Enter confirms the highlighted row, and a stale hit can be that row.
 */
export function hitsForQuery<T>(query: string, search: { query: string; hits: T[] }): T[] {
  const trimmed = query.trim();
  if (!trimmed || search.query.trim() !== trimmed) return [];
  return search.hits;
}

/**
 * Index Enter confirms before the user moves the highlight.
 * A typed query always starts at the top; an empty query starts on the current project.
 */
export function initialHighlightIndex(
  rows: { kind: string; id: string }[],
  query: string,
  selectedProjectId: string | null,
): number {
  if (rows.length === 0) return 0;
  if (query.trim()) return 0;
  const currentIndex = rows.findIndex((row) => row.kind === 'project' && row.id === selectedProjectId);
  return currentIndex >= 0 ? currentIndex : 0;
}

/**
 * True when this row is already the task's project, so picking it should only close.
 * An unresolved project tag (tag present, project not in the loaded list) is not "no project":
 * selectedProjectId is null in both cases, but the tag still has to be removable.
 */
export function isCurrentProjectChoice(
  row: { kind: 'clear' } | { kind: 'project'; id: string },
  selectedProjectId: string | null,
  hasProjectTag: boolean,
): boolean {
  if (row.kind === 'clear') return !hasProjectTag;
  return selectedProjectId !== null && row.id === selectedProjectId;
}

/** Swap the task's project:<slug> tag. Clearing passes null and removes every project tag. */
export async function applyProjectTagChange(
  projectTags: { id: string; name: string }[],
  next: { tagName: string } | null,
  addTag: (tagName: string) => Promise<unknown>,
  removeTag: (tagId: string) => Promise<unknown>,
): Promise<void> {
  if (next && !projectTags.some((tag) => tag.name === next.tagName)) {
    await addTag(next.tagName);
  }
  for (const tag of projectTags) {
    if (tag.name !== next?.tagName) {
      await removeTag(tag.id);
    }
  }
}
