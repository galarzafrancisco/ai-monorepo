import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { TaskerooService } from "./taskeroo.service";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

@Injectable()
export class TaskerooMcpGateway {

  constructor(private readonly taskerooService: TaskerooService) { }

  private buildServer(): McpServer {
    const server = new McpServer({
      name: 'taskeroo',
      version: '0.0.0',
    });

    server.registerTool(
      'list_tasks',
      {
        title: 'List tasks',
        description: 'Use to get a summary of tasks available', // Keep descriptions short to save tokens. Explain when to use it.
        // inputSchema: {}, // If we don't need schemas, avoid them to save tokens
        // outputSchema: {}, // If we don't need schemas, avoid them to save tokens
      },
      async ({ }) => {
        const tasks = await this.taskerooService.listTasks({
          page: 0,
          limit: 20,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tasks),
          }],
        }
      }
    )

    server.registerTool(
      'add_numbers',
      {
        title: 'Adds numbers',
        description: '', // Title is enough to explain what this does, so no description is required. Save tokens! The models are smart enough.
        inputSchema: {
          a: z.number(), // Model will figure out what this input is, so no need to add description. But if the input were more complex, then yeah.
          b: z.number(), // Model will figure out what this input is, so no need to add description. But if the input were more complex, then yeah.
        },
        outputSchema: {
          result: z.number(),  // This is just an example showing how you'd provide structured output. Don't really need it for something simple like this.
        },
      },
      async ({ a, b }) => {
        const result = a + b;
        return {
          content: [
            {
              type: 'text',
              text: `${a} + ${b} = ${result}`
            }
          ],
          structuredContent: {
            result
          }
        }
      }
    )
    return server;
  }

  async handleRequest(req: Request, res: Response) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    const server = this.buildServer()
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}