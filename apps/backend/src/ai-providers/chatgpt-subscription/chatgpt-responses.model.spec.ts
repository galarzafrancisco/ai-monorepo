import { generateText, isStepCount, jsonSchema, streamText, tool } from 'ai';
import {
  createChatgptResponsesModel,
  requireCompletedResponse,
  sanitizeResponsesBody,
  TOOL_NAMESPACE,
  UNSUPPORTED_BODY_FIELDS,
} from './chatgpt-responses.model';

// The errors package is ESM, which this Jest setup does not load. Codes equal their names.
jest.mock('@taico/errors', () => ({
  ErrorCodes: new Proxy({}, { get: (_target, name) => name }),
}));

const API = 'https://api.openai.test/v1';

type Recorded = { url: string; headers: Headers; body: Record<string, any> };

const sse = (events: Array<Record<string, unknown>>): string =>
  events
    .map(
      (event) =>
        `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`,
    )
    .join('');

const created = {
  type: 'response.created',
  response: { id: 'resp_1', created_at: 1, model: 'm' },
};
const completed = {
  type: 'response.completed',
  response: { usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 } },
};
const text = (value: string) => [
  {
    type: 'response.output_item.added',
    output_index: 0,
    item: { type: 'message', id: 'msg_1' },
  },
  {
    type: 'response.output_text.delta',
    item_id: 'msg_1',
    output_index: 0,
    delta: value,
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: { type: 'message', id: 'msg_1' },
  },
];
const functionCall = {
  type: 'function_call',
  id: 'fc_1',
  call_id: 'call_1',
  name: 'lookup',
  namespace: TOOL_NAMESPACE.name,
  arguments: '{"id":"42"}',
};

function harness(replies: Array<string | Response>) {
  const requests: Recorded[] = [];
  const outcomes: Array<string | null> = [];
  let tokenCalls = 0;

  const fakeFetch = (async (url: string, init: RequestInit) => {
    requests.push({
      url,
      headers: new Headers(init.headers),
      body: JSON.parse(init.body as string),
    });
    const reply = replies.shift();
    if (reply instanceof Response) {
      return reply;
    }
    return new Response(reply ?? sse([created, ...text('ok'), completed]), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    });
  }) as unknown as typeof fetch;

  const model = createChatgptResponsesModel({
    modelId: 'gpt-plan-large',
    apiBaseUrl: API,
    getAccessToken: async () => `token-${++tokenCalls}`,
    onOutcome: (code) => outcomes.push(code),
    fetch: fakeFetch,
  });

  return { model, requests, outcomes };
}

/** Runs the model the way the threads agent does and returns the text or the error. */
async function run(
  model: ReturnType<typeof harness>['model'],
  options: Partial<Parameters<typeof streamText>[0]> = {},
): Promise<{ text: string; error: unknown }> {
  let error: unknown = null;
  let collected = '';
  const result = streamText({
    model,
    instructions: 'You are Taico.',
    messages: [{ role: 'user', content: 'hello' }],
    onError: () => undefined,
    ...options,
  } as Parameters<typeof streamText>[0]);

  // A failure arrives as an error part or as the stream itself failing; both end the turn.
  try {
    for await (const part of result.stream) {
      if (part.type === 'text-delta') {
        collected += part.text;
      }
      if (part.type === 'error') {
        error = part.error;
      }
    }
  } catch (thrown) {
    error = thrown;
  }
  return { text: collected, error };
}

describe('ChatGPT plan Responses model', () => {
  it('sends a streamed, unstored request with the person’s token and no system input item', async () => {
    const { model, requests, outcomes } = harness([
      sse([created, ...text('Hi there'), completed]),
    ]);

    const { text: answer, error } = await run(model, {
      temperature: 0.2,
      maxOutputTokens: 100,
      topP: 0.9,
    });

    expect(error).toBeNull();
    expect(answer).toBe('Hi there');
    expect(requests).toHaveLength(1);

    const [request] = requests;
    expect(request.url).toBe(`${API}/responses`);
    expect(request.headers.get('authorization')).toBe('Bearer token-1');
    expect(request.body).toMatchObject({
      model: 'gpt-plan-large',
      store: false,
      stream: true,
    });
    for (const field of UNSUPPORTED_BODY_FIELDS) {
      expect(request.body).not.toHaveProperty(field);
    }

    const roles = (request.body.input as Array<{ role?: string }>).map(
      (item) => item.role,
    );
    expect(roles).toEqual(['developer', 'user']);
    expect(JSON.stringify(request.body.input)).toContain('You are Taico.');
    expect(outcomes).toEqual([null]);
  });

  it('puts function tools in a namespace, runs them, and replays the whole exchange', async () => {
    const { model, requests } = harness([
      sse([
        created,
        {
          type: 'response.output_item.added',
          output_index: 0,
          item: { ...functionCall, arguments: '' },
        },
        {
          type: 'response.output_item.done',
          output_index: 0,
          item: { ...functionCall, status: 'completed' },
        },
        completed,
      ]),
      sse([created, ...text('It is 42.'), completed]),
    ]);
    const execute = jest.fn(async () => ({ title: 'The answer' }));

    const { text: answer, error } = await run(model, {
      tools: {
        lookup: tool({
          description: 'Looks something up',
          inputSchema: jsonSchema<{ id: string }>({
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
          }),
          execute,
        }),
      },
      stopWhen: isStepCount(5),
    });

    expect(error).toBeNull();
    expect(answer).toBe('It is 42.');
    expect(execute).toHaveBeenCalledWith({ id: '42' }, expect.anything());

    expect(requests[0].body.tools).toEqual([
      expect.objectContaining({
        type: 'namespace',
        name: TOOL_NAMESPACE.name,
        tools: [expect.objectContaining({ type: 'function', name: 'lookup' })],
      }),
    ]);

    // Nothing is kept at OpenAI, so the second request carries the call and its result.
    const second = requests[1];
    expect(second.headers.get('authorization')).toBe('Bearer token-2');
    expect(second.body).not.toHaveProperty('previous_response_id');
    expect(second.body.input).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'function_call',
          call_id: 'call_1',
          name: 'lookup',
          namespace: TOOL_NAMESPACE.name,
        }),
        expect.objectContaining({
          type: 'function_call_output',
          call_id: 'call_1',
        }),
      ]),
    );
  });

  // A thread on the plan answered "what's the time?" by calling
  // tasks__get_all_tags. The model chose it: names reach OpenAI unchanged
  // and the call it returns runs the tool it names.
  it('sends get_time by its own name next to the MCP tools and runs only it', async () => {
    const getTimeCall = {
      type: 'function_call',
      id: 'fc_t',
      call_id: 'call_t',
      name: 'get_time',
      namespace: TOOL_NAMESPACE.name,
      arguments: '{}',
    };
    const { model, requests } = harness([
      sse([
        created,
        { type: 'response.output_item.added', output_index: 0, item: { ...getTimeCall, arguments: '' } },
        { type: 'response.output_item.done', output_index: 0, item: { ...getTimeCall, status: 'completed' } },
        completed,
      ]),
      sse([created, ...text('It is 5pm.'), completed]),
    ]);
    const noInput = jsonSchema<Record<string, never>>({ type: 'object', properties: {} });
    const getAllTags = jest.fn(async () => [{ name: 'code' }]);
    const getTime = jest.fn(async () => ({ now: '2026-10-16T17:00:00+11:00' }));

    const { text: answer, error } = await run(model, {
      tools: {
        tasks__get_all_tags: tool({ description: 'List all available tags', inputSchema: noInput, execute: getAllTags }),
        context__get_all_tags: tool({ description: 'List all available tags', inputSchema: noInput, execute: getAllTags }),
        get_time: tool({ description: 'Get the current date and time', inputSchema: noInput, execute: getTime }),
      },
      stopWhen: isStepCount(5),
    });

    expect(error).toBeNull();
    expect(answer).toBe('It is 5pm.');
    const [namespace] = requests[0].body.tools;
    expect(namespace.tools.map((t: { name: string }) => t.name)).toEqual([
      'tasks__get_all_tags',
      'context__get_all_tags',
      'get_time',
    ]);
    expect(getTime).toHaveBeenCalledTimes(1);
    expect(getAllTags).not.toHaveBeenCalled();
  });

  it('refuses a non-streaming call without sending anything', async () => {
    const { model, requests } = harness([]);

    await expect(generateText({ model, prompt: 'hello' })).rejects.toThrow(
      /streamed requests/,
    );
    expect(requests).toHaveLength(0);
  });

  it('fails with the plan’s usage-limit error when the response fails after some text', async () => {
    const { model, requests, outcomes } = harness([
      sse([
        created,
        ...text('Partial'),
        {
          type: 'response.failed',
          sequence_number: 5,
          response: {
            error: {
              code: 'subscription_sharing_usage_limit_exceeded',
              message: 'limit',
            },
          },
        },
      ]),
    ]);

    const { error } = await run(model);

    expect(error).toMatchObject({
      code: 'AI_PROVIDER_REQUEST_FAILED',
      context: { upstreamCode: 'subscription_sharing_usage_limit_exceeded' },
    });
    expect((error as Error).message).toContain(
      'https://chatgpt.com/settings/usage',
    );
    expect((error as Error).message).toContain(
      'did not switch to another provider',
    );
    expect(requests).toHaveLength(1);
    expect(outcomes).toEqual(['subscription_sharing_usage_limit_exceeded']);
  });

  it('treats an incomplete response as a failure', async () => {
    const { model } = harness([
      sse([
        created,
        ...text('Half an ans'),
        {
          type: 'response.incomplete',
          response: { incomplete_details: { reason: 'max_output_tokens' } },
        },
      ]),
    ]);

    const { error } = await run(model);

    expect(error).toMatchObject({
      context: { upstreamCode: 'response_incomplete' },
    });
  });

  it('treats a stream that ends before response.completed as a failure', async () => {
    const { model, outcomes } = harness([
      sse([created, ...text('Half an ans')]),
    ]);

    const { error } = await run(model);

    expect(error).toMatchObject({
      context: { upstreamCode: 'stream_ended_before_completion' },
    });
    expect(outcomes).toEqual(['stream_ended_before_completion']);
  });

  it.each([
    [429, 'subscription_sharing_usage_limit_exceeded'],
    [503, 'subscription_sharing_usage_unavailable'],
    [403, 'subscription_sharing_user_not_eligible'],
    [400, 'subscription_sharing_unsupported_capability'],
  ])('reports HTTP %i %s once, without retrying', async (status, code) => {
    const { model, requests, outcomes } = harness([
      new Response(
        JSON.stringify({ error: { code, message: 'no', param: 'tools' } }),
        {
          status,
          headers: {
            'content-type': 'application/json',
            'x-request-id': 'req_9',
          },
        },
      ),
    ]);

    const { error } = await run(model);

    expect(error).toMatchObject({
      code: 'AI_PROVIDER_REQUEST_FAILED',
      context: {
        upstreamCode: code,
        status,
        requestId: 'req_9',
        param: 'tools',
      },
    });
    expect(requests).toHaveLength(1);
    expect(outcomes).toEqual([code]);
  });
});

describe('sanitizeResponsesBody', () => {
  it('forces streaming and no storage, and drops what the plan does not accept', () => {
    const sanitized = sanitizeResponsesBody({
      model: 'm',
      store: true,
      stream: false,
      previous_response_id: 'resp_0',
      conversation: 'conv_1',
      temperature: 1,
      max_output_tokens: 5,
      metadata: { a: 'b' },
      user: 'someone',
      input: [
        { type: 'message', role: 'system', content: 'be nice' },
        { role: 'user', content: 'hi' },
      ],
    });

    expect(sanitized).toEqual({
      model: 'm',
      store: false,
      stream: true,
      input: [
        { type: 'message', role: 'developer', content: 'be nice' },
        { role: 'user', content: 'hi' },
      ],
    });
  });
});

describe('requireCompletedResponse', () => {
  const pipe = async (chunks: string[]) => {
    const outcomes: unknown[] = [];
    const source = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });
    const reader = source
      .pipeThrough(
        requireCompletedResponse((failure) => outcomes.push(failure)),
      )
      .getReader();
    let output = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      output += new TextDecoder().decode(value);
    }
    return { output, outcomes };
  };

  it('passes a completed stream through, even when events are split across chunks', async () => {
    const whole = sse([created, ...text('ok'), completed]);
    const middle = Math.floor(whole.length / 2);

    const { output, outcomes } = await pipe([
      whole.slice(0, middle),
      whole.slice(middle),
    ]);

    expect(output).toBe(whole);
    expect(outcomes).toEqual([null]);
  });

  it('errors on an error event', async () => {
    await expect(
      pipe([
        sse([
          created,
          { type: 'error', code: 'server_error', message: 'boom' },
        ]),
      ]),
    ).rejects.toMatchObject({ context: { upstreamCode: 'server_error' } });
  });
});
