import { TaskStatus } from 'src/tasks/enums';
import {
  ASSISTANT_PROMPT,
  DEV_PROMPT,
  REVIEWER_PROMPT,
} from 'src/app-init/prompts/prompts';
import {
  ANTHROPIC_CLAUDE,
  CODEX,
  COPILOT_CLAUDE,
  GEMINI_FLASH,
  GPT_5_4,
} from 'src/app-init/models/models';
import { AgentType } from './enums';
import {
  AgentAvatarDto,
  AgentTemplateCatalogResponseDto,
  AgentTemplateDto,
  AgentTemplateHarnessDto,
  AgentTemplateModelOptionDto,
} from './dto/agent-template-catalog-response.dto';
import { AGENT_AVATARS, getAgentAvatarUrlById } from './agent-avatar.library';

const defaultModelOption: AgentTemplateModelOptionDto = {
  id: 'default',
  label: 'Default',
  isDefault: true,
};

const modelOption = ({
  label,
  providerId,
  modelId,
}: {
  label: string;
  providerId: string;
  modelId: string;
}): AgentTemplateModelOptionDto => ({
  id: `${providerId || 'default-provider'}:${modelId}`,
  label,
  providerId: providerId || undefined,
  modelId,
  isDefault: false,
});

export const AGENT_TEMPLATE_HARNESSES: AgentTemplateHarnessDto[] = [
  {
    type: AgentType.CLAUDE,
    label: 'Claude Code',
    description: 'Run tasks through the Claude Code harness.',
    modelOptions: [
      defaultModelOption,
      modelOption({
        label: 'Claude Sonnet 4.6',
        providerId: ANTHROPIC_CLAUDE.providerId,
        modelId: ANTHROPIC_CLAUDE.modelId,
      }),
    ],
  },
  {
    type: AgentType.OPENCODE,
    label: 'OpenCode',
    description: 'Run tasks through the OpenCode harness.',
    modelOptions: [
      defaultModelOption,
      modelOption({
        label: 'GPT-5.3 Codex',
        providerId: CODEX.providerId,
        modelId: CODEX.modelId,
      }),
      modelOption({
        label: 'GPT-5.4',
        providerId: GPT_5_4.providerId,
        modelId: GPT_5_4.modelId,
      }),
    ],
  },
  {
    type: AgentType.ADK,
    label: 'ADK',
    description: 'Run tasks through the Google ADK harness.',
    modelOptions: [
      defaultModelOption,
      modelOption({
        label: 'Gemini 2.5 Flash',
        providerId: GEMINI_FLASH.providerId,
        modelId: GEMINI_FLASH.modelId,
      }),
    ],
  },
  {
    type: AgentType.GITHUBCOPILOT,
    label: 'GitHub Copilot',
    description: 'Run tasks through the GitHub Copilot harness.',
    modelOptions: [
      defaultModelOption,
      modelOption({
        label: 'Claude Sonnet 4.6',
        providerId: COPILOT_CLAUDE.providerId,
        modelId: COPILOT_CLAUDE.modelId,
      }),
      modelOption({
        label: 'GPT-5.3 Codex',
        providerId: CODEX.providerId,
        modelId: CODEX.modelId,
      }),
      modelOption({
        label: 'GPT-5.4',
        providerId: GPT_5_4.providerId,
        modelId: GPT_5_4.modelId,
      }),
    ],
  },
  {
    type: AgentType.OTHER,
    label: 'Other',
    description: 'Use a custom or externally managed harness.',
    modelOptions: [defaultModelOption],
  },
];

export const AGENT_TEMPLATES: AgentTemplateDto[] = [
  {
    id: 'developer',
    label: 'Developer',
    description: 'Picks up queued implementation tasks and brings them to review.',
    type: AgentType.OPENCODE,
    providerId: CODEX.providerId,
    modelId: CODEX.modelId,
    agentDescription: 'Developer agent for implementation tasks.',
    systemPrompt: DEV_PROMPT,
    statusTriggers: [TaskStatus.NOT_STARTED],
    tagTriggers: [],
    avatarUrl: getAgentAvatarUrlById('openai') ?? undefined,
    concurrencyLimit: 1,
  },
  {
    id: 'code-reviewer',
    label: 'Code reviewer',
    description: 'Reviews code tasks when they are ready for review.',
    type: AgentType.OPENCODE,
    providerId: CODEX.providerId,
    modelId: CODEX.modelId,
    agentDescription:
      'Automated code reviewer that examines PRs and provides feedback on tasks marked for review.',
    systemPrompt: REVIEWER_PROMPT,
    statusTriggers: [TaskStatus.FOR_REVIEW],
    tagTriggers: ['code'],
    avatarUrl: getAgentAvatarUrlById('cockatoo') ?? undefined,
    concurrencyLimit: 1,
  },
  {
    id: 'general-helper',
    label: 'General helper',
    description: 'Handles general tasks and asks for clarification when needed.',
    type: AgentType.ADK,
    modelId: GEMINI_FLASH.modelId,
    agentDescription: 'General helper for task execution.',
    systemPrompt: ASSISTANT_PROMPT,
    statusTriggers: [TaskStatus.NOT_STARTED],
    tagTriggers: [],
    avatarUrl: getAgentAvatarUrlById('gemini') ?? undefined,
    concurrencyLimit: 1,
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Start with a blank prompt and choose the behavior later.',
    type: AgentType.OTHER,
    agentDescription: '',
    systemPrompt: '',
    statusTriggers: [],
    tagTriggers: [],
    concurrencyLimit: 1,
  },
];

export const AGENT_TEMPLATE_CATALOG: AgentTemplateCatalogResponseDto = {
  templates: AGENT_TEMPLATES,
  harnesses: AGENT_TEMPLATE_HARNESSES,
  avatars: AGENT_AVATARS satisfies AgentAvatarDto[],
};
