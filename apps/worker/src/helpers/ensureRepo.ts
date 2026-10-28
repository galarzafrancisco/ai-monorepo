import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { credentialHelper, GITHUB_CREDENTIAL_KEY } from "./githubCredentials.js";

type EnsureRepoProps = {
  repo: string;
  dir: string;
  /**
   * File holding a GitHub token for this repository. When set, git uses it
   * for github.com (clone, fetch, and the agent's own pushes) through a
   * credential helper set in the repository's local config. When not set,
   * any helper Taico set before is removed and the machine's own credentials apply.
   */
  tokenFile?: string;
}

function git(args: string[], options: { allowFailure?: boolean } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    // execFile (no shell) so repo URLs / paths are never interpreted by a shell.
    execFile("git", args, (err, stdout, stderr) => {
      if (err && !options.allowFailure) {
        reject(new Error(stderr || stdout || err.message));
      } else {
        resolve();
      }
    });
  });
}

export async function ensureRepo({ repo, dir, tokenFile }: EnsureRepoProps) {
  const gitDir = join(dir, ".git");
  const helper = tokenFile ? credentialHelper(tokenFile) : null;
  // For this one command: only our helper answers for github.com (an empty value resets the list).
  const withHelper = helper ? ["-c", `${GITHUB_CREDENTIAL_KEY}=`, "-c", `${GITHUB_CREDENTIAL_KEY}=${helper}`] : [];

  if (!existsSync(gitDir)) {
    console.log(`[git] cloning ${repo} into ${dir}`);
    await git([...withHelper, "clone", "--", repo, dir]);
  } else {
    console.log(`[git] repo exists at ${dir}, fetching`);
    if (helper) {
      // A token only works over HTTPS; the workspace may hold an older SSH clone.
      await git(["-C", dir, "remote", "set-url", "origin", repo]);
    }
    await git([...withHelper, "-C", dir, "fetch", "--prune"]);
  }

  await setRepoCredentialHelper(dir, helper);
}

/** Leaves exactly our helper (or none) in the repository's local config, for the agent's git commands. */
async function setRepoCredentialHelper(dir: string, helper: string | null) {
  // Exit code 5 means there was nothing to unset.
  await git(["-C", dir, "config", "--local", "--unset-all", GITHUB_CREDENTIAL_KEY], { allowFailure: true });
  if (!helper) return;
  await git(["-C", dir, "config", "--local", "--add", GITHUB_CREDENTIAL_KEY, ""]);
  await git(["-C", dir, "config", "--local", "--add", GITHUB_CREDENTIAL_KEY, helper]);
}
