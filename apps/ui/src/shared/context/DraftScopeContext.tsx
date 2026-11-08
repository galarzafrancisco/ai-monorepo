import { createContext } from 'react';

/**
 * Whose drafts these are: `<actorId>:<workspaceId>`, or null until both are
 * known. `useDraftState` keeps drafts under this scope, so a draft typed in
 * one workspace (or by one person) never shows up in another. While it is
 * null, drafts are neither loaded nor saved.
 */
export const DraftScopeContext = createContext<string | null>(null);

/** Draft keys from before drafts were scoped. Never loaded into any workspace; deleted. */
const UNSCOPED_DRAFT_KEY_PREFIXES = [
  'new-task-draft',
  'new-agent-wizard-draft',
  'thread-chat-draft-',
  'new-comment-draft-',
  'answer-input-request-draft-',
];

export function removeUnscopedDrafts(): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && UNSCOPED_DRAFT_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        stale.push(key);
      }
    }
    stale.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage may be unavailable.
  }
}
