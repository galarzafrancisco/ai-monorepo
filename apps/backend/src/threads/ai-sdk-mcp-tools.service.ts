import { Injectable, Logger } from '@nestjs/common';
import { createMCPClient, type MCPClient } from '@ai-sdk/mcp';
import type { ToolSet } from 'ai';
import { getConfig } from 'src/config/env.config';

@Injectable()
export class AiSdkMcpToolsService {
  private readonly logger = new Logger(AiSdkMcpToolsService.name);

  async createTools(token: string): Promise<{ tools: ToolSet; close: () => Promise<void> }> {
    const clients: MCPClient[] = [];
    const close = async () => {
      const results = await Promise.allSettled(clients.map((client) => client.close()));
      for (const result of results) {
        if (result.status === 'rejected') {
          this.logger.warn({ message: 'Failed to close MCP client', error: String(result.reason) });
        }
      }
    };

    try {
      const tools: ToolSet = {};
      for (const [namespace, path] of [
        ['tasks', '/api/v1/tasks/tasks/mcp'],
        ['context', '/api/v1/context/blocks/mcp'],
      ]) {
        const client = await createMCPClient({
          transport: {
            type: 'http',
            url: `${getConfig().issuerUrl}${path}`,
            headers: { Authorization: `Bearer ${token}` },
          },
        });
        clients.push(client);
        for (const [name, tool] of Object.entries(await client.tools())) {
          tools[`${namespace}__${name}`] = tool;
        }
      }
      return { tools, close };
    } catch (error) {
      await close();
      throw error;
    }
  }
}
