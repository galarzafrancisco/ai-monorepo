/** A pull request on github.com. */
export type PullRequestRef = {
  owner: string;
  repo: string;
  number: number;
};

/** GitHub logins and repository names: letters, digits, `-`, `_` and `.`. */
const PULL_REQUEST_URL =
  /https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/pull\/(\d{1,9})(?![\d])/g;

/** The lower-case key a pull request is stored under. */
export function pullRequestKey(ref: PullRequestRef): string {
  return `${ref.owner}/${ref.repo}#${ref.number}`.toLowerCase();
}

export function pullRequestUrl(ref: PullRequestRef): string {
  return `https://github.com/${ref.owner}/${ref.repo}/pull/${ref.number}`;
}

/**
 * Every distinct github.com pull request linked in a text, in order of first
 * appearance. Links to a pull request's tabs or comments
 * (`/pull/12/files`, `/pull/12#issuecomment-1`) count as the pull request.
 */
export function extractPullRequestRefs(text: string | null | undefined): PullRequestRef[] {
  if (!text) return [];
  const seen = new Set<string>();
  const refs: PullRequestRef[] = [];
  for (const match of text.matchAll(PULL_REQUEST_URL)) {
    const ref = { owner: match[1], repo: match[2], number: Number(match[3]) };
    const key = pullRequestKey(ref);
    if (ref.number < 1 || seen.has(key)) continue;
    seen.add(key);
    refs.push(ref);
  }
  return refs;
}

/** A pull request from a link (`https://github.com/o/r/pull/1`) or a short reference (`o/r#1`). */
export function parsePullRequestRef(value: string): PullRequestRef | null {
  const trimmed = value.trim();
  const short = trimmed.match(/^([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)#(\d{1,9})$/);
  if (short) {
    const number = Number(short[3]);
    return number >= 1 ? { owner: short[1], repo: short[2], number } : null;
  }
  return extractPullRequestRefs(trimmed)[0] ?? null;
}
