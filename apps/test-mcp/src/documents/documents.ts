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

    server.registerTool(
      'read_document',
      {
        title: 'Read document',
        inputSchema: {
          type: 'object',
          properties: {
            fileName: {
              type: 'string',
              description: 'The name of the file to read',
            },
          },
          required: ['fileName'],
        },
      },
      async (args: { fileName: string }) => {
        try {
          const content = await this.documentsService.readDocument(auth.token, args.fileName);

          return {
            content: [
              {
                type: "text",
                text: content,
              }
            ]
          };
        } catch (error) {
          this.logger.error('Error reading document:', error);
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

    server.registerTool(
      'upload_document',
      {
        title: 'Upload document',
        inputSchema: {
          type: 'object',
          properties: {
            fileName: {
              type: 'string',
              description: 'The name of the file to upload',
            },
            content: {
              type: 'string',
              description: 'The text content to upload',
            },
          },
          required: ['fileName', 'content'],
        },
      },
      async (args: { fileName: string; content: string }) => {
        try {
          await this.documentsService.uploadDocument(auth.token, args.fileName, args.content);

          return {
            content: [
              {
                type: "text",
                text: `File ${args.fileName} uploaded successfully`,
              }
            ]
          };
        } catch (error) {
          this.logger.error('Error uploading document:', error);
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
