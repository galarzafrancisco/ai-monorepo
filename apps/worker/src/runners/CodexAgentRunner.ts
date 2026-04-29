import { AgentModelConfig } from "./AgentRunner.js";
import { OpencodeAgentRunner } from "./OpenCodeAgentRunner.js";

export class CodexAgentRunner extends OpencodeAgentRunner {
  constructor(modelConfig: AgentModelConfig = {}) {
    super({
      providerId: modelConfig.providerId ?? 'openai',
      modelId: modelConfig.modelId ?? 'gpt-5.3-codex',
    }, 'codex');
  }
}
