import { LanguageModel, LanguageModelMiddleware, wrapLanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { AiProviderRequestFailedError } from '../errors/ai-providers.errors';
import {
  chatgptRequestFailed,
  STREAM_ENDED_EARLY,
  STREAM_FAILED,
  STREAM_INCOMPLETE,
  UpstreamFailure,
} from './chatgpt-subscription.errors';
import { THREAD_TOOL_NAMESPACE, withToolNamespaces } from '../tool-namespaces';

/**
 * Sign in with ChatGPT accepts function tools only inside a namespace. Every
 * provider gets its tools in namespaces (see ai-providers/tool-namespaces);
 * the plan model applies them too, so its requests are valid however it is
 * wrapped. Tools without a server prefix go in this one.
 */
export const TOOL_NAMESPACE = THREAD_TOOL_NAMESPACE;

/** Request fields OpenAI rejects for plan-backed requests. Removed if anything sets them. */
export const UNSUPPORTED_BODY_FIELDS = [
  'background',
  'conversation',
  'max_output_tokens',
  'max_tool_calls',
  'metadata',
  'moderation',
  'multi_agent',
  'previous_response_id',
  'prompt',
  'prompt_cache_retention',
  'safety_identifier',
  'temperature',
  'top_logprobs',
  'top_p',
  'truncation',
  'user',
] as const;

export type ChatgptResponsesModelInput = {
  modelId: string;
  /** Base of the public API, e.g. https://api.openai.com/v1. */
  apiBaseUrl: string;
  /** Called before every request, so a long turn always sends a current token. */
  getAccessToken: () => Promise<string>;
  /** Told how each request ended: the upstream error code, or null on success. */
  onOutcome?: (upstreamCode: string | null) => void;
  fetch?: typeof fetch;
};

type ResponsesBody = Record<string, unknown> & { input?: unknown };

/**
 * Makes a request body acceptable for a plan-backed request, whatever the
 * caller asked for: streamed, not stored at OpenAI, the whole conversation in
 * `input`, and no system-role input items.
 */
export function sanitizeResponsesBody(body: ResponsesBody): ResponsesBody {
  const sanitized: ResponsesBody = { ...body, store: false, stream: true };
  for (const field of UNSUPPORTED_BODY_FIELDS) {
    delete sanitized[field];
  }

  if (Array.isArray(sanitized.input)) {
    sanitized.input = sanitized.input.map((item: unknown) =>
      item &&
      typeof item === 'object' &&
      (item as { role?: unknown }).role === 'system'
        ? { ...item, role: 'developer' }
        : item,
    );
  }

  return sanitized;
}

function failureFromEvent(
  event: Record<string, unknown>,
): UpstreamFailure | null {
  const response = (event.response ?? {}) as {
    error?: { code?: unknown; message?: unknown } | null;
    incomplete_details?: { reason?: unknown } | null;
  };

  switch (event.type) {
    case 'response.failed':
      return {
        code:
          typeof response.error?.code === 'string'
            ? response.error.code
            : STREAM_FAILED,
        message:
          typeof response.error?.message === 'string'
            ? response.error.message
            : null,
      };
    case 'response.incomplete':
      return {
        code: STREAM_INCOMPLETE,
        message:
          typeof response.incomplete_details?.reason === 'string'
            ? response.incomplete_details.reason
            : null,
      };
    case 'error': {
      const error = (event.error ?? event) as {
        code?: unknown;
        message?: unknown;
        param?: unknown;
      };
      return {
        code: typeof error.code === 'string' ? error.code : STREAM_FAILED,
        message: typeof error.message === 'string' ? error.message : null,
        param: typeof error.param === 'string' ? error.param : null,
      };
    }
    default:
      return null;
  }
}

/**
 * Passes server-sent events through and fails the stream unless it ends with
 * `response.completed`. A failed or incomplete response, an error event, and a
 * connection that closes early are all failures; text received before that is
 * not an answer.
 */
export function requireCompletedResponse(
  onOutcome: (failure: UpstreamFailure | null) => void,
): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let completed = false;
  let failed = false;

  const fail = (
    controller: TransformStreamDefaultController<Uint8Array>,
    failure: UpstreamFailure,
  ) => {
    failed = true;
    onOutcome(failure);
    controller.error(chatgptRequestFailed(failure));
  };

  return new TransformStream({
    transform(chunk, controller) {
      if (failed) {
        return;
      }
      buffer += decoder.decode(chunk, { stream: true });

      for (;;) {
        const boundary = /\r?\n\r?\n/.exec(buffer);
        if (!boundary) {
          return;
        }
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);

        const data = frame
          .split(/\r?\n/)
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');

        if (data && data !== '[DONE]') {
          let event: Record<string, unknown> | null = null;
          try {
            event = JSON.parse(data) as Record<string, unknown>;
          } catch {
            // Not JSON: left for the SDK's parser to report.
          }
          const failure = event ? failureFromEvent(event) : null;
          if (failure) {
            fail(controller, failure);
            return;
          }
          if (event?.type === 'response.completed') {
            completed = true;
          }
        }

        controller.enqueue(encoder.encode(`${frame}\n\n`));
      }
    },
    flush(controller) {
      if (failed) {
        return;
      }
      if (!completed) {
        fail(controller, { code: STREAM_ENDED_EARLY, message: null });
        return;
      }
      onOutcome(null);
    },
  });
}

async function failureFromResponse(
  response: Response,
): Promise<UpstreamFailure> {
  const text = await response.text().catch(() => '');
  let error: { code?: unknown; message?: unknown; param?: unknown } = {};
  try {
    const parsed = JSON.parse(text) as { error?: typeof error };
    error = parsed.error ?? {};
  } catch {
    // Not JSON: the status is all there is.
  }
  return {
    code: typeof error.code === 'string' ? error.code : null,
    message:
      typeof error.message === 'string'
        ? error.message
        : text.slice(0, 300) || null,
    status: response.status,
    param: typeof error.param === 'string' ? error.param : null,
    requestId: response.headers.get('x-request-id'),
  };
}

/** The plan failure inside an error, looking through the SDK's wrappers. */
function planFailureIn(error: unknown): AiProviderRequestFailedError | null {
  for (let current = error, depth = 0; current && depth < 5; depth++) {
    if (current instanceof AiProviderRequestFailedError) {
      return current;
    }
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/**
 * Removes sampling and length settings the plan does not accept, sends the
 * instructions as a developer message, and puts every function tool in a
 * namespace: thread tools first, then one per MCP server.
 */
const planRequestMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v4',
  transformParams: async ({ params }) => {
    for (const tool of params.tools ?? []) {
      if (tool.type !== 'function') {
        throw chatgptRequestFailed({
          code: 'subscription_sharing_unsupported_capability',
          message: `Tool ${tool.name} is not a function tool.`,
          param: 'tools',
        });
      }
    }

    return {
      ...withToolNamespaces(params),
      maxOutputTokens: undefined,
      temperature: undefined,
      topP: undefined,
      topK: undefined,
      presencePenalty: undefined,
      frequencyPenalty: undefined,
      seed: undefined,
      providerOptions: {
        ...params.providerOptions,
        openai: {
          ...params.providerOptions?.openai,
          store: false,
          systemMessageMode: 'developer',
        },
      },
    };
  },
  // Every plan-backed request must be streamed, so a non-streaming call is a bug in the caller.
  wrapGenerate: async () => {
    throw new Error(
      'The ChatGPT plan only accepts streamed requests. Call streamText() for this model.',
    );
  },
  // The SDK wraps a failure of the response body in its own error. Hand back the original,
  // which says what happened in words meant for the person.
  wrapStream: async ({ doStream }) => {
    let result: Awaited<ReturnType<typeof doStream>>;
    try {
      result = await doStream();
    } catch (error) {
      throw planFailureIn(error) ?? error;
    }

    const reader = result.stream.getReader();
    type Part = Awaited<ReturnType<typeof reader.read>>['value'];
    const stream = new ReadableStream<NonNullable<Part>>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
          } else if (value.type === 'error') {
            controller.enqueue({
              ...value,
              error: planFailureIn(value.error) ?? value.error,
            });
          } else {
            controller.enqueue(value);
          }
        } catch (error) {
          controller.error(planFailureIn(error) ?? error);
        }
      },
      cancel: (reason) => reader.cancel(reason),
    });

    return { ...result, stream };
  },
};

/**
 * An AI SDK model that runs on one person's ChatGPT plan.
 *
 * It is the stock OpenAI Responses model with a guarded transport: the only
 * request it can make is a streamed, unstored `POST /responses` with that
 * person's OAuth token, and the stream counts as an answer only when OpenAI
 * says the response completed. Errors are not retried.
 */
export function createChatgptResponsesModel(
  input: ChatgptResponsesModelInput,
): LanguageModel {
  const baseURL = input.apiBaseUrl.replace(/\/+$/, '');
  const responsesUrl = `${baseURL}/responses`;
  const doFetch = input.fetch ?? fetch;
  const report = (failure: UpstreamFailure | null) =>
    input.onOutcome?.(
      failure
        ? (failure.code ??
            (failure.status ? `http_${failure.status}` : 'unknown'))
        : null,
    );

  const guardedFetch = async (
    target: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const url =
      typeof target === 'string'
        ? target
        : target instanceof URL
          ? target.href
          : target.url;
    if (
      url !== responsesUrl ||
      init?.method !== 'POST' ||
      typeof init.body !== 'string'
    ) {
      throw chatgptRequestFailed({
        code: 'subscription_sharing_route_not_supported',
        message: null,
      });
    }

    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${await input.getAccessToken()}`);
    headers.set('accept', 'text/event-stream');

    const response = await doFetch(responsesUrl, {
      ...init,
      headers,
      body: JSON.stringify(
        sanitizeResponsesBody(JSON.parse(init.body) as ResponsesBody),
      ),
    });

    if (!response.ok || !response.body) {
      const failure = await failureFromResponse(response);
      report(failure);
      // Thrown as it is, so the SDK does not treat it as a retryable API error.
      throw chatgptRequestFailed(failure);
    }

    return new Response(
      response.body.pipeThrough(requireCompletedResponse(report)),
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      },
    );
  };

  const openai = createOpenAI({
    // The SDK requires a key; the guarded fetch replaces the header with the OAuth token.
    apiKey: 'sign-in-with-chatgpt',
    baseURL,
    fetch: guardedFetch as typeof fetch,
  });

  return wrapLanguageModel({
    model: openai.responses(input.modelId),
    middleware: planRequestMiddleware,
  });
}
