import 'dotenv/config';
import { OpencodeAgentRunner } from "./runners/OpenCodeAgentRunner.js";
import { AgentModelConfig, AgentRunCallbacks, AgentRunContext } from './runners/AgentRunner.js';

async function dev() {
  const modelConfig: AgentModelConfig = {
    providerId: 'spark-qwen3-coder-next-fp8',
    modelId: 'Qwen/Qwen3-Coder-Next-FP8',
  };
  const taskId = '123';
  const runId = 'xzy';

  const runner = new OpencodeAgentRunner(modelConfig);
  
  const ctx: AgentRunContext = {
    taskId,
    prompt: "Run pwd and tell me what you see",
    cwd: `/Users/franciscogalarza/github/ai-monorepo/apps/worker/temp/asds`,
    runId,
  };
  
  const callbacks: AgentRunCallbacks = {
    onEvent: (message: string) => {
      console.log(message);
    },
    onError: (err) => {
      console.error(err.message);
      console.error(err.rawMessage);
    }
  }

  await runner.run(ctx, callbacks);
  return;
}

dev();