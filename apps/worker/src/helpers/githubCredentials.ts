import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toRepoDirName } from "./projectRepos.js";

/** Git config key for credentials of github.com over HTTPS only. */
export const GITHUB_CREDENTIAL_KEY = "credential.https://github.com.helper";

/**
 * A git credential helper that answers `get` with the token in `tokenFile`.
 * The token is read at the moment git asks, so it never appears in git
 * config, remote URLs, process arguments or the agent's environment.
 */
export function credentialHelper(tokenFile: string): string {
  const quoted = `'${tokenFile.replace(/'/g, `'\\''`)}'`;
  return `!f() { test "$1" = get || exit 0; echo username=x-access-token; printf 'password=%s\\n' "$(cat ${quoted})"; }; f`;
}

/**
 * Where an execution's tokens live: outside every repository and the agent's
 * working directory, readable by the worker's user only, and removed when the
 * execution ends (removeTokenDir).
 */
export function tokenDir(baseDir: string, executionId: string): string {
  return join(baseDir, ".taico-credentials", toRepoDirName(executionId));
}

export function writeTokenFile(dir: string, projectSlug: string, token: string): string {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  const file = join(dir, `${toRepoDirName(projectSlug)}.token`);
  writeFileSync(file, token, { mode: 0o600 });
  chmodSync(file, 0o600);
  return file;
}

export function removeTokenDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
