import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AgentQuotaExceededError,
  AgentOverloadedError,
  RunnerProcessError,
  classifyAgentError,
  classifyRunnerError,
} from '../task-execution-errors.js';
import { getClaudeResultError } from '../runners/ClaudeAgentRunner.js';
import type { SDKResultMessage } from '@anthropic-ai/claude-agent-sdk';

const sessionLimit = "You've hit your session limit · resets 4:50pm (Australia/Sydney)";

test('classifies a Claude session-limit result as out of quota', () => {
  const message = getClaudeResultError({
    type: 'result',
    subtype: 'error_during_execution',
    errors: [sessionLimit],
  } as SDKResultMessage);
  assert.equal(message, sessionLimit);
  const error = classifyAgentError({ message: message! });
  assert.ok(error instanceof AgentQuotaExceededError);
  assert.equal(error.errorCode, 'OUT_OF_QUOTA');
  assert.equal(error.displayMessage, sessionLimit);
});

test('does not interpret successful Claude results as errors', () => {
  assert.equal(getClaudeResultError({
    type: 'result', subtype: 'success', is_error: false, result: 'Done',
  } as SDKResultMessage), null);
});

test('classifies a thrown Claude session-limit error as out of quota', () => {
  const error = classifyRunnerError(new Error(sessionLimit));
  assert.ok(error instanceof AgentQuotaExceededError);
  assert.equal(error.errorCode, 'OUT_OF_QUOTA');
  assert.equal(error.displayMessage, sessionLimit);
});

test('keeps overloaded and unrelated runner errors distinct', () => {
  assert.ok(classifyRunnerError(new Error('API Error: 529 overloaded')) instanceof AgentOverloadedError);
  const unrelated = classifyRunnerError(new Error('connection closed'));
  assert.ok(unrelated instanceof RunnerProcessError);
  assert.equal(unrelated.errorCode, 'UNKNOWN');
});
