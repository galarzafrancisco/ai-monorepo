const PROJECT_TAG_PREFIX = 'project:';
const RECENT_LIMIT = 8;

export type RankableProject = {
  id: string;
  slug: string;
  tagName: string;
  description?: string;
  repoUrl?: string;
  updatedAt: string;
};

export type ProjectSection = {
  title: string;
  projects: RankableProject[];
};

type TaskActivity = {
  tags: { name: string }[];
  updatedAt: string;
};

/** Latest task update per project tag. Projects with no tasks in the pool are absent. */
export function activityByProjectTag(tasks: TaskActivity[]): Map<string, number> {
  const activity = new Map<string, number>();
  for (const task of tasks) {
    const time = Date.parse(task.updatedAt);
    if (Number.isNaN(time)) continue;
    for (const tag of task.tags) {
      if (!tag.name.startsWith(PROJECT_TAG_PREFIX)) continue;
      const previous = activity.get(tag.name) ?? 0;
      if (time > previous) activity.set(tag.name, time);
    }
  }
  return activity;
}

export function projectSections(
  projects: RankableProject[],
  query: string,
  rememberedIds: string[],
  activity: Map<string, number>,
  serverHits: RankableProject[] = [],
): ProjectSection[] {
  const trimmed = query.trim();
  if (!trimmed) {
    const ordered = [...projects].sort((a, b) => compareByRecency(a, b, rememberedIds, activity));
    const recentIds = new Set(recentProjects(projects, rememberedIds, activity).map((project) => project.id));
    const recent = ordered.filter((project) => recentIds.has(project.id));
    const rest = ordered.filter((project) => !recentIds.has(project.id));
    const sections: ProjectSection[] = [];
    if (recent.length > 0) sections.push({ title: 'Recent', projects: recent });
    if (rest.length > 0) sections.push({ title: 'All projects', projects: rest });
    return sections;
  }

  const ranked = rankProjects(projects, trimmed);
  const rankedIds = new Set(ranked.map((project) => project.id));
  const extra = serverHits.filter((project) => !rankedIds.has(project.id));
  const results = [...ranked, ...extra];
  return results.length > 0 ? [{ title: 'Results', projects: results }] : [];
}

const CLEAR_PHRASES = ['no project', 'none', 'clear', 'remove', 'no'];

export function matchesClearProject(query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return CLEAR_PHRASES.includes(normalized);
}

function recentProjects(
  projects: RankableProject[],
  rememberedIds: string[],
  activity: Map<string, number>,
): RankableProject[] {
  const byId = new Map(projects.map((project) => [project.id, project]));
  const picked = rememberedIds
    .map((id) => byId.get(id))
    .filter((project): project is RankableProject => project !== undefined);
  const pickedIds = new Set(picked.map((project) => project.id));
  const active = projects
    .filter((project) => !pickedIds.has(project.id) && (activity.get(project.tagName) ?? 0) > 0)
    .sort((a, b) => (activity.get(b.tagName) ?? 0) - (activity.get(a.tagName) ?? 0));
  return [...picked, ...active].slice(0, RECENT_LIMIT);
}

function compareByRecency(
  a: RankableProject,
  b: RankableProject,
  rememberedIds: string[],
  activity: Map<string, number>,
): number {
  const aPick = rememberedIds.indexOf(a.id);
  const bPick = rememberedIds.indexOf(b.id);
  const aRank = aPick === -1 ? Number.POSITIVE_INFINITY : aPick;
  const bRank = bPick === -1 ? Number.POSITIVE_INFINITY : bPick;
  if (aRank !== bRank) return aRank - bRank;
  const aActivity = activity.get(a.tagName) ?? 0;
  const bActivity = activity.get(b.tagName) ?? 0;
  if (aActivity !== bActivity) return bActivity - aActivity;
  const aUpdated = Date.parse(a.updatedAt) || 0;
  const bUpdated = Date.parse(b.updatedAt) || 0;
  if (aUpdated !== bUpdated) return bUpdated - aUpdated;
  return a.slug.localeCompare(b.slug);
}

function rankProjects(projects: RankableProject[], query: string): RankableProject[] {
  const scored = projects.map((project) => ({
    project,
    strict: scoreProject(project, query, false),
    fuzzy: scoreProject(project, query, true),
  }));
  const anyStrict = scored.some((row) => row.strict > 0);
  return scored
    .filter((row) => (anyStrict ? row.strict : row.fuzzy) > 0)
    .sort((a, b) => (b.strict || b.fuzzy) - (a.strict || a.fuzzy) || a.project.slug.localeCompare(b.project.slug))
    .map((row) => row.project);
}

function scoreProject(project: RankableProject, query: string, typos: boolean): number {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;
  let total = 0;
  for (const word of words) {
    const wordScore = Math.max(
      fieldScore(project.slug, word, 100, typos),
      fieldScore(project.tagName.replace(/^project:/, ''), word, 90, typos),
      fieldScore(project.tagName, word, 70, typos),
      fieldScore(project.description ?? '', word, 40, typos),
      fieldScore(project.repoUrl ?? '', word, 30, typos),
    );
    if (wordScore === 0) return 0;
    total += wordScore;
  }
  return total;
}

function fieldScore(field: string, word: string, weight: number, typos: boolean): number {
  const value = field.toLowerCase();
  if (!value) return 0;
  if (value === word) return weight * 5;
  if (value.startsWith(word)) return weight * 4;
  const tokens = value.split(/[^a-z0-9]+/).filter(Boolean);
  if (tokens.some((token) => token === word)) return weight * 4;
  if (tokens.some((token) => token.startsWith(word))) return weight * 3;
  if (value.includes(word)) return weight * 2;
  if (typos && (tokens.some((token) => isTypo(token, word)) || isTypo(value, word))) return weight;
  return 0;
}

function isTypo(value: string, word: string): boolean {
  if (word.length < 3 || value.length < 3) return false;
  const allowed = word.length >= 8 ? 2 : 1;
  const distance = levenshtein(value, word, allowed);
  return distance > 0 && distance <= allowed;
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, index) => index);
  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    let rowMin = current[0];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > max) return max + 1;
    previous = current;
  }
  return previous[cols - 1];
}
