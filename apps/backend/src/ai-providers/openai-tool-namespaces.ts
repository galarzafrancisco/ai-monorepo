import { LanguageModelMiddleware } from 'ai';

type CallTools = Parameters<
  NonNullable<LanguageModelMiddleware['transformParams']>
>[0]['params']['tools'];

/**
 * The namespace for tools that do not come from an MCP server, such as the
 * threads agent's own tools (`get_time`, `remind`, …).
 */
export const TOOL_NAMESPACE = {
  name: 'taico',
  description: "Taico's own tools for this conversation.",
} as const;

/**
 * The OpenAI tool namespace a tool is sent in: one per MCP server for tools
 * named `<server>__<tool>`, and `TOOL_NAMESPACE` for every other tool.
 *
 * Tools are not all put in one namespace: with Taico's own tools in the same
 * namespace as dozens of MCP tools, the model all but stopped calling them. A
 * thread asked for the time called `tasks__get_all_tags` instead of `get_time`,
 * and kept calling it. Giving each group its own namespace fixed that.
 */
export function toolNamespace(toolName: string): {
  name: string;
  description: string;
} {
  const separator = toolName.indexOf('__');
  if (separator <= 0) {
    return TOOL_NAMESPACE;
  }
  const server = toolName.slice(0, separator);
  return { name: server, description: `Taico ${server} tools.` };
}

/** Puts every function tool in its namespace (see `toolNamespace`). Other tools are left as they are. */
export function withToolNamespaces(tools: CallTools): CallTools {
  return tools?.map((tool) =>
    tool.type === 'function'
      ? {
          ...tool,
          providerOptions: {
            ...tool.providerOptions,
            openai: {
              ...tool.providerOptions?.openai,
              namespace: toolNamespace(tool.name),
            },
          },
        }
      : tool,
  );
}

/**
 * For an OpenAI Responses model: sends its function tools in namespaces. The
 * AI SDK still finds the tool a call names by its name alone, so names stay as
 * they are.
 */
export const openaiToolNamespacesMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v4',
  transformParams: async ({ params }) => ({
    ...params,
    tools: withToolNamespaces(params.tools),
  }),
};
