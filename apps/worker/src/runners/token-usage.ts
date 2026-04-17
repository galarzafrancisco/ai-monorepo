import { TokenUsage } from './AgentRunner.js';

const INPUT_KEYS = new Set([
  'inputtokens',
  'inputtoken',
  'input_tokens',
  'prompttokens',
  'prompttoken',
  'prompt_tokens',
  'prompttokencount',
]);

const OUTPUT_KEYS = new Set([
  'outputtokens',
  'outputtoken',
  'output_tokens',
  'completiontokens',
  'completiontoken',
  'completion_tokens',
  'candidatestokencount',
]);

const TOTAL_KEYS = new Set([
  'totaltokens',
  'totaltoken',
  'total_tokens',
  'totaltokencount',
  'tokenusage',
]);

type UnknownRecord = Record<string, unknown>;

export function extractTokenUsage(payload: unknown): TokenUsage | null {
  const queue: unknown[] = [payload];
  const visited = new Set<unknown>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!isObject(current) || visited.has(current)) {
      continue;
    }
    visited.add(current);

    const usage = readUsage(current);
    if (usage) {
      return usage;
    }

    for (const value of Object.values(current)) {
      if (isObject(value)) {
        queue.push(value);
      }
    }
  }

  return null;
}

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function readUsage(record: UnknownRecord): TokenUsage | null {
  let inputTokens: number | null | undefined;
  let outputTokens: number | null | undefined;
  let totalTokens: number | null | undefined;

  for (const [key, value] of Object.entries(record)) {
    const normalizedKey = key.toLowerCase();
    const numericValue = toTokenCount(value);
    if (numericValue === null) {
      continue;
    }

    if (INPUT_KEYS.has(normalizedKey)) {
      inputTokens = numericValue;
      continue;
    }

    if (OUTPUT_KEYS.has(normalizedKey)) {
      outputTokens = numericValue;
      continue;
    }

    if (TOTAL_KEYS.has(normalizedKey)) {
      totalTokens = numericValue;
    }
  }

  if (
    inputTokens === undefined &&
    outputTokens === undefined &&
    totalTokens === undefined
  ) {
    return null;
  }

  if (
    totalTokens === undefined &&
    inputTokens !== null &&
    inputTokens !== undefined &&
    outputTokens !== null &&
    outputTokens !== undefined
  ) {
    totalTokens = inputTokens + outputTokens;
  }

  return {
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function toTokenCount(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }

  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return Math.trunc(value);
}
