import type { ApiClient } from '@taico/client/v2';
import { writeTokenFile } from './githubCredentials.js';
import type { ProjectRepo } from './projectRepos.js';

export type GithubCredentialsForRun = {
  /** The repos to prepare: those with a token use its HTTPS clone URL and token file. */
  repos: ProjectRepo[];
  /**
   * Environment for the harness, when a token was issued: GH_TOKEN for the gh
   * CLI, plus GH_HOST and GH_ENTERPRISE_TOKEN on a GitHub Enterprise.
   */
  env: Record<string, string>;
};

/**
 * Asks Taico for GitHub tokens for this execution's projects and stores each
 * in its own 0600 file. Projects without one (no connection, or the project
 * does not let workers use it) keep their URL and the machine's own
 * credentials. Failing to get tokens never fails the run: it falls back to
 * the machine's credentials too.
 */
export async function issueGithubCredentials({
  workerClient,
  executionId,
  tokenDirectory,
  repos,
}: {
  workerClient: ApiClient;
  executionId: string;
  tokenDirectory: string;
  repos: ProjectRepo[];
}): Promise<GithubCredentialsForRun> {
  if (repos.length === 0) return { repos, env: {} };

  let credentials: Array<{ projectSlug: string; cloneUrl: string; host: string; token: string }> = [];
  try {
    credentials = (
      await workerClient.executions.ActiveTaskExecutionController_issueGithubCredentials({ executionId })
    ).credentials;
  } catch (error) {
    console.warn(
      `[worker] could not get GitHub credentials for execution ${executionId}, using the machine's own: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { repos, env: {} };
  }

  const bySlug = new Map(credentials.map((credential) => [credential.projectSlug, credential]));
  const prepared = repos.map((repo) => {
    const credential = bySlug.get(repo.slug);
    if (!credential) return repo;
    console.log(`[worker] using a GitHub token from Taico for project '${repo.slug}' (${credential.host})`);
    return {
      ...repo,
      repoUrl: credential.cloneUrl,
      tokenFile: writeTokenFile(tokenDirectory, repo.slug, credential.token),
    };
  });

  // gh takes one token. The first project's is used; with a GitHub App it only reaches that repository.
  const first = repos.map((repo) => bySlug.get(repo.slug)).find(Boolean);
  if (!first) return { repos: prepared, env: {} };
  const env: Record<string, string> = { GH_TOKEN: first.token };
  if (first.host !== "github.com") {
    env.GH_HOST = first.host;
    env.GH_ENTERPRISE_TOKEN = first.token;
  }
  return { repos: prepared, env };
}
