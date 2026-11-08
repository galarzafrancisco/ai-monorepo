import { CreateAgentInput } from 'src/agents/dto/service/agents.service.types';
import {
  LEGACY_ASSISTANT_PROMPTS,
  LEGACY_DEV_PROMPTS,
  LEGACY_REVIEWER_PROMPTS,
} from '../prompts/legacy-prompts';
import { createClaudeDev } from './claude-dev.agent';
import { createCodeReviewer } from './code-reviewer.agent';
import { createCodexDev } from './codex-dev.agent';
import { createDeveloper } from './developer.agent';
import { createGeminiAssistant } from './gemini-assistant.agent';
import { createGrok } from './grok.agent';
import { createGrokDev } from './grok-dev.agent';
import { createLead } from './lead.agent';
import { createPlanner } from './planner.agent';
import { createPlanReviewer } from './plan-reviewer.agent';
import { createShipper } from './shipper.agent';
import { createTaico } from './taico.agent';
import { createTaskmaster } from './taskmaster.agent';

export type SeededAgent = {
  seed: CreateAgentInput;
  /**
   * Earlier seeded versions of this agent's prompt. At startup, a default
   * workspace agent whose prompt is still one of these verbatim is moved to the
   * current one.
   */
  legacyPrompts?: readonly string[];
};

/**
 * The built-in agents every workspace starts with: the default workspace at
 * startup (`AppInitRunner.ensureAgents`) and every new workspace when it is
 * created (`WorkspaceAdminService.provision`).
 */
export const SEEDED_AGENTS: readonly SeededAgent[] = [
  { seed: createTaico },
  { seed: createClaudeDev, legacyPrompts: LEGACY_DEV_PROMPTS },
  { seed: createDeveloper, legacyPrompts: LEGACY_DEV_PROMPTS },
  { seed: createCodexDev, legacyPrompts: LEGACY_DEV_PROMPTS },
  { seed: createGeminiAssistant, legacyPrompts: LEGACY_ASSISTANT_PROMPTS },
  { seed: createGrok },
  { seed: createGrokDev, legacyPrompts: LEGACY_DEV_PROMPTS },
  { seed: createCodeReviewer, legacyPrompts: LEGACY_REVIEWER_PROMPTS },
  { seed: createShipper },
  { seed: createLead },
  { seed: createPlanner },
  { seed: createPlanReviewer },
  { seed: createTaskmaster },
];
