export const PROJECT_TAG_PREFIX = 'project:';

export type ProjectRepo = {
  slug: string;
  repoUrl: string;
  /** File holding a GitHub token Taico issued for this repository, if any. */
  tokenFile?: string;
};

export type SkippedProjectReason = 'not_found' | 'no_repo_url';

export type SkippedProject = {
  slug: string;
  reason: SkippedProjectReason;
};

export type ResolvedProjectRepos = {
  repos: ProjectRepo[];
  skipped: SkippedProject[];
};

type ProjectLike = { repoUrl?: string | null } | null | undefined;

export type ProjectLookup = (slug: string) => Promise<ProjectLike>;

/**
 * Extract the unique project slugs from a task's tags, keeping tag order.
 * Tags like "project:" (empty slug) are ignored.
 */
export function getProjectSlugsFromTags(
  tags: ReadonlyArray<{ name: string }> | null | undefined,
): string[] {
  const slugs: string[] = [];
  for (const tag of tags ?? []) {
    if (!tag?.name?.startsWith(PROJECT_TAG_PREFIX)) {
      continue;
    }
    const slug = tag.name.slice(PROJECT_TAG_PREFIX.length).trim();
    if (slug && !slugs.includes(slug)) {
      slugs.push(slug);
    }
  }
  return slugs;
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status?: unknown }).status === 404
  );
}

/**
 * Look up every project slug and split them into cloneable repos and
 * projects that were skipped (missing project, or project without a repo).
 * Unexpected lookup errors (anything other than a 404) are rethrown.
 */
export async function resolveProjectRepos(
  slugs: string[],
  lookup: ProjectLookup,
): Promise<ResolvedProjectRepos> {
  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return { slug, project: await lookup(slug) };
      } catch (error) {
        if (isNotFoundError(error)) {
          return { slug, project: null };
        }
        throw error;
      }
    }),
  );

  const repos: ProjectRepo[] = [];
  const skipped: SkippedProject[] = [];
  for (const { slug, project } of results) {
    if (!project) {
      skipped.push({ slug, reason: 'not_found' });
      continue;
    }
    const repoUrl = project.repoUrl?.trim();
    if (!repoUrl) {
      skipped.push({ slug, reason: 'no_repo_url' });
      continue;
    }
    repos.push({ slug, repoUrl });
  }

  return { repos, skipped };
}

/**
 * Turn a project slug into a safe, single-segment directory name.
 */
export function toRepoDirName(slug: string): string {
  const cleaned = slug.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^\.+/, '');
  return cleaned || 'project';
}
