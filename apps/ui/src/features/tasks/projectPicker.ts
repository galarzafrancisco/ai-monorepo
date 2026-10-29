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
 * A typed query always starts at the top; an empty query starts on an assigned project.
 */
export function initialHighlightIndex(
  rows: { kind: string; id: string }[],
  query: string,
  selectedProjectIds: string[],
): number {
  if (rows.length === 0) return 0;
  if (query.trim()) return 0;
  const selected = new Set(selectedProjectIds);
  const currentIndex = rows.findIndex((row) => row.kind === 'project' && selected.has(row.id));
  return currentIndex >= 0 ? currentIndex : 0;
}

/**
 * True when picking this row should only close.
 * An assigned project is already on the task. Clear is a no-op only when no
 * project tag exists — an unresolved tag still has to be removable.
 */
export function isCurrentProjectChoice(
  row: { kind: 'clear' } | { kind: 'project'; id: string },
  selectedProjectIds: string[],
  hasProjectTag: boolean,
): boolean {
  if (row.kind === 'clear') return !hasProjectTag;
  return selectedProjectIds.includes(row.id);
}

/**
 * Add one project tag, or clear every project tag when next is null.
 * Adding does not remove the others. Clearing removes unresolved tags too.
 */
export async function applyProjectTagChange(
  projectTags: { id: string; name: string }[],
  next: { tagName: string } | null,
  addTag: (tagName: string) => Promise<unknown>,
  removeTag: (tagId: string) => Promise<unknown>,
): Promise<void> {
  if (next) {
    if (!projectTags.some((tag) => tag.name === next.tagName)) {
      await addTag(next.tagName);
    }
    return;
  }
  for (const tag of projectTags) {
    await removeTag(tag.id);
  }
}

/** Remove one project assignment, including the last one. Other project tags stay. */
export async function removeProjectAssignment(
  projectTags: { id: string; name: string }[],
  tagId: string,
  removeTag: (tagId: string) => Promise<unknown>,
): Promise<void> {
  if (!projectTags.some((tag) => tag.id === tagId)) return;
  await removeTag(tagId);
}
