export type MODEL_CONFIG = {
  providerId: string;
  modelId: string;
  name: string;
};

// Good for OpenCode and GitHub Copilot runners
export const CODEX: MODEL_CONFIG = {
  providerId: 'openai',
  modelId: 'gpt-5.3-codex',
  name: 'codex',
};

export const GPT_5_4: MODEL_CONFIG = {
  providerId: 'openai',
  modelId: 'gpt-5.4',
  name: 'gpt-5.4',
};

export const GPT_5_5: MODEL_CONFIG = {
  providerId: 'openai',
  modelId: 'gpt-5.5',
  name: 'gpt-5.5',
};

// Good for GitHub Copilot runner
export const COPILOT_CLAUDE: MODEL_CONFIG = {
  providerId: '',
  modelId: 'claude-sonnet-4.6',
  name: 'claude',
};
// Good for Claude runner
export const ANTHROPIC_CLAUDE: MODEL_CONFIG = {
  providerId: '',
  modelId: 'claude-sonnet-4-6',
  name: 'claude',
};
// Good for ADK runner
export const GEMINI_FLASH: MODEL_CONFIG = {
  providerId: '',
  modelId: 'gemini-2.5-flash',
  name: 'gemini',
};
