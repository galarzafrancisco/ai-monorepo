/**
 * Slug of the built-in agent that powers thread chat. The system looks it up
 * by slug, so it cannot be deleted.
 */
export const THREAD_AGENT_SLUG = 'taico';

export const PROTECTED_AGENT_SLUGS: readonly string[] = [THREAD_AGENT_SLUG];
