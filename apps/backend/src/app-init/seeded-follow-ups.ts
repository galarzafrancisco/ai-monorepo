import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import { createClaudeDev } from './agent/claude-dev.agent';
import { createCodeReviewer } from './agent/code-reviewer.agent';
import { createCodexDev } from './agent/codex-dev.agent';
import { createDeveloper } from './agent/developer.agent';
import { createGeminiAssistant } from './agent/gemini-assistant.agent';
import { createGrokDev } from './agent/grok-dev.agent';
import { createShipper } from './agent/shipper.agent';
import {
  ASSISTANT_FOLLOW_UP_PROMPT,
  ASSISTANT_PROMPT,
  DEV_FOLLOW_UP_PROMPT,
  DEV_PROMPT,
  REVIEWER_FOLLOW_UP_PROMPT,
  REVIEWER_PROMPT,
} from './prompts/prompts';
import {
  LEGACY_ASSISTANT_PROMPTS,
  LEGACY_DEV_PROMPTS,
  LEGACY_REVIEWER_PROMPTS,
} from './prompts/legacy-prompts';

/** Built-in agents that come with a follow-up prompt. */
const AGENTS_WITH_FOLLOW_UP: readonly CreateAgentInput[] = [
  createClaudeDev,
  createDeveloper,
  createCodexDev,
  createGrokDev,
  createCodeReviewer,
  createShipper,
  createGeminiAssistant,
];

/** Agents made from a template keep its prompt, which identifies the template. */
const FOLLOW_UPS_BY_SYSTEM_PROMPT: readonly {
  systemPrompts: readonly string[];
  followUpPrompt: string;
}[] = [
  {
    systemPrompts: [DEV_PROMPT, ...LEGACY_DEV_PROMPTS],
    followUpPrompt: DEV_FOLLOW_UP_PROMPT,
  },
  {
    systemPrompts: [ASSISTANT_PROMPT, ...LEGACY_ASSISTANT_PROMPTS],
    followUpPrompt: ASSISTANT_FOLLOW_UP_PROMPT,
  },
  {
    systemPrompts: [REVIEWER_PROMPT, ...LEGACY_REVIEWER_PROMPTS],
    followUpPrompt: REVIEWER_FOLLOW_UP_PROMPT,
  },
];

/** The follow-up of the built-in or template an existing agent came from. */
export function seededFollowUpFor(agent: {
  slug: string;
  systemPrompt: string | null;
}): string | undefined {
  const seeded = AGENTS_WITH_FOLLOW_UP.find((seed) => seed.slug === agent.slug);
  if (seeded?.followUpPrompt) return seeded.followUpPrompt;

  const stored = normalizePrompt(agent.systemPrompt);
  return FOLLOW_UPS_BY_SYSTEM_PROMPT.find(({ systemPrompts }) =>
    systemPrompts.some((prompt) => normalizePrompt(prompt) === stored),
  )?.followUpPrompt;
}

export function normalizePrompt(prompt: string | null | undefined): string {
  return (prompt ?? '').replace(/\r\n/g, '\n').trim();
}
