export type MODEL_CONFIG = {
  providerId: string;
  modelId: string;
  name: string;
};

export const CODEX: MODEL_CONFIG = {
  providerId: 'openai',
  modelId: 'gpt-5.3-codex',
  name: 'codex',
};

export const COPILOT_CLAUDE: MODEL_CONFIG = {
  providerId: '',
  modelId: 'claude-sonnet-4.6',
  name: 'claude',
};
export const ANTHROPIC_CLAUDE: MODEL_CONFIG = {
  providerId: '',
  modelId: 'claude-sonnet-4-6',
  name: 'claude',
};

export const GEMINI_FLASH: MODEL_CONFIG = {
  providerId: '',
  modelId: 'gemini-2.5-flash',
  name: 'gemini',
}