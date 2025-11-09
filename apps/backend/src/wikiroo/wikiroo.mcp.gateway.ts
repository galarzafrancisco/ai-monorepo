import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { WikirooService } from "./wikiroo.service";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

@Injectable()
export class WikirooMcpGateway {

  constructor(private readonly wikirooService: WikirooService) { }

  private buildServer(): McpServer {
    const server = new McpServer({
      name: 'wikiroo',
      version: '0.0.0',
    });

    server.registerTool(
      'list_pages',
      {
        title: 'List wiki pages',
        description: 'Get a list of all wiki pages with metadata (title, id, author)',
      },
      async ({ }) => {
        const pages = await this.wikirooService.listPages();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(pages),
          }],
        }
      }
    )

    server.registerTool(
      'get_page',
      {
        title: 'Get wiki page',
        description: 'Retrieve the full content of a wiki page by ID',
        inputSchema: {
          pageId: z.string(),
        },
      },
      async ({ pageId }) => {
        const page = await this.wikirooService.getPageById(pageId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(page),
          }],
        }
      }
    )

    server.registerTool(
      'create_page',
      {
        title: 'Create wiki page',
        description: 'Create a new wiki page with title, content, and author',
        inputSchema: {
          title: z.string(),
          content: z.string(),
          author: z.string(),
        },
      },
      async ({ title, content, author }) => {
        const page = await this.wikirooService.createPage({
          title,
          content,
          author,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(page),
          }],
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
