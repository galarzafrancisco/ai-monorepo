#!/usr/bin/env node

import { ADKAgentRunner } from "./runners/ADKAgentRunner.js";
import { AgentRunCallbacks, AgentRunContext } from "./runners/AgentRunner.js";
import { ClaudeAgentRunner } from "./runners/ClaudeAgentRunner.js";
import { CodexAgentRunner } from "./runners/CodexAgentRunner.js";
import { GitHubCopilotAgentRunner } from "./runners/GitHubCopilotAgentRunner.js";
import { OpencodeAgentRunner } from "./runners/OpenCodeAgentRunner.js";

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createOpencode } from "@opencode-ai/sdk";

const TOKEN = "";

type AgentArgs = { runContext: AgentRunContext, callbacks: AgentRunCallbacks };

async function main(): Promise<void> {

  const runContext: AgentRunContext = {
    taskId: '830d2707-1b8e-4bba-a4d5-62418b2df65a', // this is not really needed I just found out, never used
    // prompt: `Fetch task 830d2707-1b8e-4bba-a4d5-62418b2df65a and do what it says`,
    prompt: `Show me what tools and mcp servers you have available. Use tasks to list tasks not started and list agents`,
    cwd: '/Users/franciscogalarza/github/ai-monorepo/tmp/worker-test',
    baseUrl: 'http://localhost:2000',
    accessToken: TOKEN,
    executionId: '123', // this seems to only go as a header in the MCP connection, not really needed other than for tracking and spawning sub tasks
    agentSlug: 'claude-test',
    mcpServers: {
      tasks: {
        type: 'http',
        url: 'http://localhost:2000/api/v1/tasks/tasks/mcp',
        headers: {},
      }
    }
  };

  const onHeartbeat = () => {
    console.log('heartbeat');
  }

  const onSession = (sessionId: string) => {
    console.log(`session id: ${sessionId}`);
  }

  const onEvent = (message: string) => {
    console.log(`[event] ${message}`);
  }

  const onError = (error: { message: string; rawMessage?: any }) => {
    console.log(`[error] ${error.message}`);
    if (error.rawMessage) {
      console.log(error.rawMessage);
    }
  }

  const callbacks: AgentRunCallbacks = {
    onHeartbeat,
    onSession,
    onEvent,
    onError,
  }

  await codex({
    runContext,
    callbacks,
  });

  // await claude({
  //   runContext,
  //   callbacks,
  // });

  // await opencode({
  //   runContext,
  //   callbacks,
  // });

  // await adk({
  //   runContext,
  //   callbacks,
  // });

  // await copilot({
  //   runContext,
  //   callbacks,
  // });

  // claudeModel();
  // openCodeModel();
}

async function claudeModel() {
  const r = query({
    prompt: '',
  });
  const models = await r.supportedModels(); // <-- useless, prints display names but not the actual model keys needed to run the agent.
  console.log(models);
}

async function openCodeModel() {
  const opencode = await createOpencode({
    port: 1234,
    signal: AbortSignal.timeout(15 * 1000), // 15 seconds
    timeout: 10 * 1000, // 10 seconds
  });
  const response = await opencode.client.config.providers();
  const providers = response.data?.providers;

  providers?.forEach((provider) => {
    console.log(`Provider: ${provider.id}`);          // <-- this is good.
    Object.keys(provider.models).forEach((modelKey) => {
      const model = provider.models[modelKey];
      console.log(`  - ${modelKey}: ${model.name}`);  // <-- this is good.
    });
  });
  await opencode.client.instance.dispose(); // <-- also doesn't help the server shut down
  opencode.server.close(); // <-- this doesn't do Jack 💩 - process stays open
}

async function claude({ runContext, callbacks }: AgentArgs) {
  const runner = new ClaudeAgentRunner({});
  runner.run(runContext, callbacks);
}

async function opencode({ runContext, callbacks }: AgentArgs) {
  const runner = new OpencodeAgentRunner({});
  runner.run(runContext, callbacks);
}

async function adk({ runContext, callbacks }: AgentArgs) {
  const runner = new ADKAgentRunner({});
  runner.run(runContext, callbacks);
}

async function copilot({ runContext, callbacks }: AgentArgs) {
  const runner = new GitHubCopilotAgentRunner({});
  runner.run(runContext, callbacks);
}

async function codex({ runContext, callbacks }: AgentArgs) {
  const runner = new CodexAgentRunner({});
  runner.run(runContext, callbacks);
}

void main();
