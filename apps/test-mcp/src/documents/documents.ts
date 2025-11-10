import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DocumentsService } from './documents.service';

@Injectable()
export class Documents {

  constructor(
    private readonly documentsService: DocumentsService,
  ) {}

  private buildServer(): McpServer {
    const server = new McpServer({
      name: Documents.name,
      version: '0.0.0',
    });

    server.registerTool(
      'list_documents',
      {
        title: 'List documents',
      },
      async () => {
        const docs = await this.documentsService.listDocuments();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(docs),
            }
          ]
        };
      }
    );
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

    const server = this.buildServer();
    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);
  }
}
