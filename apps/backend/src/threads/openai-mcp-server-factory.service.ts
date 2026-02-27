import { Injectable } from "@nestjs/common";
import { IssueTokenResult } from "src/authorization-server/issued-access-token.service";
import { getConfig } from "src/config/env.config";
import { MCPServer, MCPServerStreamableHttp } from "@openai/agents";

class PrefixedMcpServer implements MCPServer {
  private readonly nameMap = new Map<string, string>();

  constructor(
    private readonly inner: MCPServer,
    private readonly prefix: string,
  ) {}

  get cacheToolsList(): boolean {
    return this.inner.cacheToolsList;
  }

  set cacheToolsList(value: boolean) {
    this.inner.cacheToolsList = value;
  }

  get toolFilter() {
    return this.inner.toolFilter;
  }

  set toolFilter(value: MCPServer["toolFilter"]) {
    this.inner.toolFilter = value;
  }

  get toolMetaResolver() {
    return this.inner.toolMetaResolver;
  }

  set toolMetaResolver(value: MCPServer["toolMetaResolver"]) {
    this.inner.toolMetaResolver = value;
  }

  get errorFunction() {
    return this.inner.errorFunction;
  }

  set errorFunction(value: MCPServer["errorFunction"]) {
    this.inner.errorFunction = value;
  }

  get name() {
    return this.inner.name;
  }

  async connect() {
    return this.inner.connect();
  }

  async close() {
    return this.inner.close();
  }

  async listTools() {
    const tools = await this.inner.listTools();
    this.nameMap.clear();

    return tools.map((tool) => {
      const prefixedName = `${this.prefix}__${tool.name}`;
      this.nameMap.set(prefixedName, tool.name);

      return {
        ...tool,
        name: prefixedName,
      };
    });
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown> | null,
    meta?: Record<string, unknown> | null,
  ) {
    const originalName =
      this.nameMap.get(toolName) ?? toolName.replace(`${this.prefix}__`, "");

    return this.inner.callTool(originalName, args, meta);
  }

  async invalidateToolsCache() {
    this.nameMap.clear();
    return this.inner.invalidateToolsCache();
  }
}

@Injectable()
export class OpenAiMcpServerFactoryService {
  public async createServers(token: IssueTokenResult): Promise<MCPServer[]> {
    const baseUrl = getConfig().issuerUrl;

    const customFetch: typeof fetch = async (
      input: URL | RequestInfo,
      init: RequestInit = {},
    ) => {
      const headers = new Headers(init.headers);

      headers.set("Authorization", `Bearer ${token.token}`);

      return fetch(input, { ...init, headers });
    };

    const tasks = new MCPServerStreamableHttp({
      name: "tasks",
      url: `${baseUrl}/api/v1/tasks/tasks/mcp`,
      requestInit: {
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      },
      fetch: customFetch,
    });

    const context = new MCPServerStreamableHttp({
      name: "context",
      url: `${baseUrl}/api/v1/context/blocks/mcp`,
      requestInit: {
        headers: {
          Authorization: `Bearer ${token.token}`,
        },
      },
      fetch: customFetch,
    });

    await Promise.all([tasks.connect(), context.connect()]);

    return [
      new PrefixedMcpServer(tasks, "tasks"),
      new PrefixedMcpServer(context, "context"),
    ];
  }
}
