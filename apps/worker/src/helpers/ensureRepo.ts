import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { credentialHelper, credentialKeyFor, TOKEN_DIR_NAME } from "./githubCredentials.js";

type EnsureRepoProps = {
  repo: string;
  dir: string;
  /**
   * File holding a GitHub token for this repository. When set, git uses it
   * for the repository's host, github.com or a GitHub Enterprise (clone,
   * fetch, and the agent's own pushes), through a
   * credential helper set in the repository's local config. When not set,
   * any helper Taico set before is removed and the machine's own credentials apply.
   */
  tokenFile?: string;
}

function git(args: string[], options: { allowFailure?: boolean } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    // execFile (no shell) so repo URLs / paths are never interpreted by a shell.
    execFile("git", args, (err, stdout, stderr) => {
      if (err && !options.allowFailure) {
        reject(new Error(stderr || stdout || err.message));
      } else {
        resolve(stdout);
      }
    });
  });
}

export async function ensureRepo({ repo, dir, tokenFile }: EnsureRepoProps) {
  const gitDir = join(dir, ".git");
  const helper = tokenFile ? credentialHelper(tokenFile) : null;
  const key = credentialKeyFor(repo);
  // For this one command: only our helper answers for the host (an empty value resets the list).
  const withHelper = helper ? ["-c", `${key}=`, "-c", `${key}=${helper}`] : [];

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

  await setRepoCredentialHelper(dir, key, helper);
}

/** Leaves exactly our helper (or none) in the repository's local config, for the agent's git commands. */
async function setRepoCredentialHelper(dir: string, key: string, helper: string | null) {
  // Helpers an earlier run set, for whichever host (the project may have moved).
  const existing = await git(["-C", dir, "config", "--local", "--get-regexp", "^credential\\..*\\.helper$"], {
    allowFailure: true,
  });
  const ours = new Set(
    existing
      .split("\n")
      .filter((line) => line.includes(TOKEN_DIR_NAME))
      .map((line) => line.split(" ")[0]),
  );
  ours.add(key);
  for (const stale of ours) {
    // Exit code 5 means there was nothing to unset.
    await git(["-C", dir, "config", "--local", "--unset-all", stale], { allowFailure: true });
  }
  if (!helper) return;
  await git(["-C", dir, "config", "--local", "--add", key, ""]);
  await git(["-C", dir, "config", "--local", "--add", key, helper]);
}
