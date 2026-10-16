import { LanguageModel, LanguageModelMiddleware, wrapLanguageModel } from 'ai';

export type ToolNamespace = { name: string; description: string };

/**
 * The namespace for tools that belong to the thread itself (get_time,
 * reminders, schedules, task watchers, stay_silent). These tools have no
 * `<server>__` prefix.
 */
export const THREAD_TOOL_NAMESPACE: ToolNamespace = {
  name: 'taico',
  description:
    'Tools for this thread: the time, reminders, schedules, task watchers and staying silent.',
};

/**
 * Namespaces for MCP tools, which are named `<server>__<tool>`. OpenAI advises
 * small namespaces. With all ~50 tools in one namespace, a model did not see
 * the last few (get_time, stay_silent) and called a similar tool instead.
 */
const MCP_TOOL_NAMESPACES: Record<string, string> = {
  tasks: 'Taico tasks: create, find, update, comment on and assign tasks.',
  context: 'Taico context blocks: shared notes and thread memory.',
};

const MCP_TOOL_NAME = /^([a-z0-9-]+)__./;

/**
 * The namespace a tool belongs to: `tasks__fetch` goes in `tasks`, and a tool
 * with no server prefix goes in the thread namespace.
 */
export function toolNamespaceFor(toolName: string): ToolNamespace {
  const server = MCP_TOOL_NAME.exec(toolName)?.[1];
  if (!server) {
    return THREAD_TOOL_NAMESPACE;
  }
  return {
    name: server,
    description: MCP_TOOL_NAMESPACES[server] ?? `Tools from Taico's ${server} server.`,
  };
}

type CallParams = Parameters<NonNullable<LanguageModelMiddleware['transformParams']>>[0]['params'];

function isThreadTool(name: string): boolean {
  return toolNamespaceFor(name).name === THREAD_TOOL_NAMESPACE.name;
}

/**
 * Puts every function tool in its namespace and lists thread tools first,
 * then each MCP server's tools. This applies to every provider:
 *
 * - OpenAI Responses models (API key and ChatGPT plan) read
 *   `providerOptions.openai.namespace` and send one namespace per group, in
 *   the order the first tool of each group appears.
 * - Other providers ignore that option. They still get the tools grouped,
 *   with the thread tools first.
 *
 * Replayed tool calls get their tool's current namespace too. Turns recorded
 * under the old single `taico` namespace, or with no namespace, then match the
 * tools in the request. Tool names never change.
 *
 * Applying this more than once gives the same result.
 */
export function withToolNamespaces(params: CallParams): CallParams {
  const tools = params.tools
    ?.map((tool) =>
      tool.type === 'function'
        ? {
            ...tool,
            providerOptions: {
              ...tool.providerOptions,
              openai: {
                ...tool.providerOptions?.openai,
                namespace: toolNamespaceFor(tool.name),
              },
            },
          }
        : tool,
    )
    // Stable sort: thread tools first, the rest keep their order.
    .sort((a, b) => Number(!isThreadTool(a.name)) - Number(!isThreadTool(b.name)));

  const prompt = params.prompt.map((message) => {
    if (message.role !== 'assistant') {
      return message;
    }
    return {
      ...message,
      content: message.content.map((part) => {
        if (part.type !== 'tool-call' || part.providerExecuted) {
          return part;
        }
        return {
          ...part,
          providerOptions: {
            ...part.providerOptions,
            openai: {
              ...part.providerOptions?.openai,
              namespace: toolNamespaceFor(part.toolName).name,
            },
          },
        };
      }),
    };
  });

  return { ...params, tools, prompt };
}

export const toolNamespaceMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v4',
  transformParams: async ({ params }) => withToolNamespaces(params),
};

/** Wraps a model so every call sends its tools in namespaces. See withToolNamespaces. */
export function withToolNamespaceMiddleware(model: LanguageModel): LanguageModel {
  if (typeof model === 'string') {
    return model;
  }
  return wrapLanguageModel({ model, middleware: toolNamespaceMiddleware });
}
