#!/usr/bin/env node

import { ADKAgentRunner } from "./runners/ADKAgentRunner.js";
import { AgentRunCallbacks, AgentRunContext } from "./runners/AgentRunner.js";
import { ClaudeAgentRunner } from "./runners/ClaudeAgentRunner.js";
import { GitHubCopilotAgentRunner } from "./runners/GitHubCopilotAgentRunner.js";
import { OpencodeAgentRunner } from "./runners/OpenCodeAgentRunner.js";

const TOKEN = "";

type AgentArgs = { runContext: AgentRunContext, callbacks: AgentRunCallbacks };

async function main(): Promise<void> {
  console.log("Hello");

  const runContext: AgentRunContext = {
    taskId: '830d2707-1b8e-4bba-a4d5-62418b2df65a', // this is not really needed I just found out, never used
    prompt: `Fetch task 830d2707-1b8e-4bba-a4d5-62418b2df65a and do what it says`,
    cwd: '/Users/franciscogalarza/github/ai-monorepo/tmp/worker-test',
    baseUrl: 'http://localhost:2000',
    accessToken: TOKEN,
    executionId: '123', // this seems to only go as a header in the MCP connection, not really needed other than for tracking and spawning sub tasks
    agentSlug: 'claude-test',
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


void main();
