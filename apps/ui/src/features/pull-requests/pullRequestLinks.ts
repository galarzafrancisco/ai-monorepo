/**
 * A pull request on github.com or a GitHub Enterprise. Mirrors
 * apps/backend/src/pull-requests/github/pull-request-ref.ts.
 */
export type PullRequestRef = {
  /** Left out on github.com; the host of a GitHub Enterprise otherwise. */
  host?: string;
  owner: string;
  repo: string;
  number: number;
};

/**
 * Any host: links on a GitHub Enterprise look the same as on github.com. The
 * backend leaves out pull requests on hosts it has no connection to, and those
 * are then drawn as plain links.
 */
const PULL_REQUEST_URL =
  /^https?:\/\/(?:www\.)?([A-Za-z0-9.-]+(?::\d{1,5})?)\/([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+)\/pull\/(\d{1,9})(?:[/?#].*)?$/;

/** The pull request a URL points at (including its tabs and comment anchors), or null. */
export function parsePullRequestUrl(url: string): PullRequestRef | null {
  const match = url.trim().match(PULL_REQUEST_URL);
  if (!match) return null;
  const number = Number(match[4]);
  if (number < 1) return null;
  const host = match[1].toLowerCase();
  const ref: PullRequestRef = { owner: match[2], repo: match[3], number };
  return host === 'github.com' ? ref : { host, ...ref };
}

/** The lower-case key the backend stores a pull request under: the host goes first on a GitHub Enterprise. */
export function pullRequestKey(ref: PullRequestRef): string {
  return pullRequestLabel(ref).toLowerCase();
}

export function pullRequestLabel(ref: PullRequestRef): string {
  return `${ref.host ? `${ref.host}/` : ''}${ref.owner}/${ref.repo}#${ref.number}`;
}

/** URLs in plain text, with the punctuation that usually ends a sentence left out. */
const URL_IN_TEXT = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,;:!?)\]}]/g;

export type TextSegment = { kind: 'text'; text: string } | { kind: 'link'; url: string };

/** Splits plain text into text and links. */
export function splitLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ kind: 'text', text: text.slice(last, start) });
    segments.push({ kind: 'link', url: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ kind: 'text', text: text.slice(last) });
  return segments;
}
