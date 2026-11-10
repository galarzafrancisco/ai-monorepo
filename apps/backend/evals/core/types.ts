/**
 * Core types for the threads agent eval system.
 *
 * Every other eval module codes against these interfaces, so change them with
 * care. See the plan in context block d6179824 (§5–§8) for the reasoning.
 *
 * Only `import type` is used here, so loading this file never pulls in backend
 * runtime code.
 */
import type { ModelMessage, ToolSet } from 'ai';
import type { ResolvedChatModel } from 'src/threads/agent/chat-model.factory';

// ---------------------------------------------------------------------------
// Grading (§5)
// ---------------------------------------------------------------------------

/** `bad` is a forbidden action. It is what must-not gates count. */
export type Outcome = 'pass' | 'fail' | 'bad';

export interface Grade {
  outcome: Outcome;
  /** Short human-readable reason, used for bucketing failures in the report. */
  reason: string;
}

export interface ObservedToolCall {
  name: string;
  args: unknown;
}

/** What the model did in one sample. Provider-agnostic. */
export interface Observation {
  /** The first tool call in the step, or the text if there was no tool call. */
  firstAction:
    | { kind: 'tool'; name: string; args: unknown }
    | { kind: 'text'; text: string }
    | { kind: 'none' };
  /** All tool calls in the step, in order. */
  toolCalls: ObservedToolCall[];
  /** All text in the step, preambles included. */
  text: string;
  reasoningTokens: number | null;
  usage: { inputTokens?: number; outputTokens?: number } | null;
  finishReason: string | null;
  latencyMs: number;
}

export type Gate =
  /** Passes when pass / (pass + fail + bad) >= rate. */
  | { kind: 'min-pass-rate'; rate: number; minSamples: number }
  /** Passes when bad <= `bad`. `minPassRate` is reported, not gated. */
  | { kind: 'max-bad'; bad: number; minSamples: number; minPassRate?: number };

// ---------------------------------------------------------------------------
// World and conversation (§4)
// ---------------------------------------------------------------------------

export interface EvalActor {
  id: string;
  displayName: string;
  slug: string;
}

/** Knobs a case may override. */
export interface WorldOptions {
  /** The fixed "now" every clock in the eval sees. */
  now: Date;
  /** The user's IANA timezone, or null when it is unknown. */
  userTimezone: string | null;
  /** When the user's latest message was sent. Defaults to `now`. */
  lastUserMessageAt: Date;
  threadId: string;
  threadSecret: string;
  actor: EvalActor;
}

/** The resolved world a case runs in. Fully deterministic. */
export interface World extends WorldOptions {
  /** A clock fixed at `now`. Passed to tool factories that take one. */
  clock: () => Date;
}

/**
 * A tool result in the conversation history. Either a literal JSON value, or
 * `run`, which runs the real tool `execute` against the world's fakes.
 */
export type ToolResultSpec =
  | { kind: 'literal'; value: unknown }
  | { kind: 'run' };

/** One entry in a case's conversation. Built with the DSL in core/conversation.ts (S4). */
export type Turn =
  | { kind: 'user'; text: string; actor?: EvalActor }
  | {
      kind: 'assistant-call';
      toolName: string;
      args: unknown;
      /** Stable id linking the call to its result. Generated when omitted. */
      toolCallId?: string;
    }
  | {
      kind: 'tool-result';
      toolCallId?: string;
      toolName: string;
      result: ToolResultSpec;
    }
  | { kind: 'assistant-text'; text: string }
  /** Text Taico injects into the conversation (hook context). */
  | { kind: 'injection'; source: string; text: string };

// ---------------------------------------------------------------------------
// Cases (§5)
// ---------------------------------------------------------------------------

/** `multi-turn` is reserved for S11 and not supported by the v1 runner. */
export type EvalLevel = 'single-step' | 'multi-turn';

export interface CaseExamples {
  pass: Observation[];
  fail?: Observation[];
  bad?: Observation[];
}

export interface EvalCase {
  /** Stable slug, e.g. 'time-what-time-is-it'. Used in results and baselines. */
  id: string;
  title: string;
  /** e.g. 'time', 'tool-choice', 'control', 'must-not'. */
  tags: string[];
  level: EvalLevel;
  world?: Partial<WorldOptions>;
  conversation: (w: World) => Turn[];
  /** May be async so a future LLM judge fits. */
  grade: (o: Observation, w: World) => Grade | Promise<Grade>;
  gate: Gate;
  /** Grader self-test: each example must grade as the bucket it is in. */
  examples: CaseExamples;
}

// ---------------------------------------------------------------------------
// Request setup (§4)
// ---------------------------------------------------------------------------

/** Everything needed to make one streamText call for a sample. */
export interface EvalSetup {
  instructions: string;
  tools: ToolSet;
  messages: ModelMessage[];
  resolved: ResolvedChatModel;
}

// ---------------------------------------------------------------------------
// Targets (§6)
// ---------------------------------------------------------------------------

export type Provider =
  | 'chatgpt-plan'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'vertex';

export const PROVIDERS: readonly Provider[] = [
  'chatgpt-plan',
  'openai',
  'anthropic',
  'google',
  'vertex',
];

/** A `provider:model` pair, e.g. `openai:gpt-5`. */
export interface TargetSpec {
  provider: Provider;
  modelId: string;
}

export type Availability = { ok: true } | { ok: false; why: string };

/** How the runner should treat an error from a sample. */
export type ErrorClass = 'retry' | 'abort-target' | 'sample-error';

export interface TargetAdapter {
  provider: Provider;
  /** Are credentials present? Is this run allowed (e.g. no plan in CI)? */
  available(): Promise<Availability>;
  resolve(
    modelId: string,
    opts: { fetch: typeof fetch },
  ): Promise<ResolvedChatModel>;
  /** e.g. a token expiry check. Run before the target and before each sample. */
  preflight?(): Promise<void>;
  classifyError(e: unknown): ErrorClass;
}

// ---------------------------------------------------------------------------
// Variants (§7)
// ---------------------------------------------------------------------------

export interface Variant {
  name: string;
  description: string;
  /** Providers the variant applies to. All when omitted. */
  appliesTo?: Provider[];
  /** AI SDK level: instructions, tools, messages. */
  setup?(s: EvalSetup, w: World): EvalSetup;
  /** Wire level, applied to the JSON request body inside the fetch hook. */
  body?(body: unknown, ctx: { provider: Provider }): unknown;
}

// ---------------------------------------------------------------------------
// Runs, results and baselines (§8)
// ---------------------------------------------------------------------------

export interface CliOptions {
  /** `provider:model` strings. Empty means the default matrix. */
  targets: string[];
  /** Case ids or tags. Empty means all cases. */
  cases: string[];
  samples: number;
  concurrency: number;
  variants: string[];
  variantOnly: boolean;
  saveBaseline: boolean;
  json: boolean;
  capture: boolean;
  help: boolean;
}

export type Verdict = 'pass' | 'fail' | 'inconclusive';

export interface Counts {
  pass: number;
  fail: number;
  bad: number;
  errored: number;
}

export interface WilsonInterval {
  low: number;
  high: number;
}

export interface SampleResult {
  index: number;
  observation: Observation | null;
  grade: Grade | null;
  /** Set when the sample errored after retries. Never contains secrets. */
  error: string | null;
  attempts: number;
}

export interface BaselineDelta {
  baselineRate: number;
  delta: number;
  /** True when the CIs of the run and the baseline don't overlap. */
  changed: boolean;
}

/** One (target, variant, case) cell of a run. */
export interface CaseResult {
  caseId: string;
  target: string;
  /** null for the no-variant (baseline) run. */
  variant: string | null;
  samples: SampleResult[];
  counts: Counts;
  /** pass / (pass + fail + bad), or null when nothing was graded. */
  rate: number | null;
  ci: WilsonInterval | null;
  gate: Gate;
  verdict: Verdict;
  /** Why the verdict is inconclusive, when it is. */
  inconclusiveReason?: string;
  /** Hash of instructions + tool names/descriptions. */
  requestFingerprint: string;
  baseline?: BaselineDelta;
}

export interface RunRecord {
  gitSha: string;
  gitDirty: boolean;
  startedAt: string;
  finishedAt: string;
  args: CliOptions;
  worldDefaults: Omit<WorldOptions, 'now' | 'lastUserMessageAt'> & {
    now: string;
    lastUserMessageAt: string;
  };
  /** Targets that were skipped, e.g. missing credentials. */
  skippedTargets: { target: string; why: string }[];
  results: CaseResult[];
  verdict: Verdict;
}

export interface BaselineCaseEntry {
  rate: number;
  n: number;
  pass: number;
  fail: number;
  bad: number;
  gitSha: string;
  date: string;
}

/** `baselines/<provider>__<model>.json`. Committed. */
export interface BaselineFile {
  target: string;
  cases: Record<string, BaselineCaseEntry>;
}

/** Process exit codes. */
export const EXIT_CODES = {
  ok: 0,
  gateFailed: 1,
  inconclusive: 2,
} as const;
