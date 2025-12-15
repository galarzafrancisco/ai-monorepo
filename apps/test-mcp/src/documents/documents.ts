import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DocumentsService } from './documents.service';
import { SELF_NAME, SELF_VERSION } from 'src/config/self.config';
import type { AuthContext } from 'src/auth/auth.types';

@Injectable()
export class Documents {

  private logger = new Logger(Documents.name);

  constructor(
    private readonly documentsService: DocumentsService,
  ) {}

  private buildServer(auth: AuthContext): McpServer {

    const server = new McpServer({
      name: SELF_NAME,
      version: SELF_VERSION,
    });

    this.logger.debug(`User: ${auth.payload.sub}`);
    this.logger.debug(`Client ID: ${auth.payload.client_id}`);
    this.logger.debug(`Scopes received:`, auth.scopes);
    this.logger.debug(auth.payload)
    server.registerTool(
      'list_documents',
      {
        title: 'List documents',
      },
      async () => {
        try {
          const files = await this.documentsService.listDocuments(auth.token);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(files, null, 2),
              }
            ]
          };
        } catch (error) {
          this.logger.error('Error listing documents:', error);
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error.message}`,
              }
            ],
            isError: true,
          };
        }
      }
    );
    return server;
  }

  async handleRequest(auth: AuthContext, req: Request, res: Response) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    const server = this.buildServer(auth);
    await server.connect(transport);

    await transport.handleRequest(req, res, req.body);
  }
}
