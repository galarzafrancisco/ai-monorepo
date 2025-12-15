import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DocumentsService } from './documents.service';
import { GcsService } from './gcs.service';
import { TokenExchangeService } from '../auth/token-exchange.service';
import { SELF_NAME, SELF_VERSION } from 'src/config/self.config';
import type { AuthContext } from 'src/auth/auth.types';

@Injectable()
export class Documents {

  private logger = new Logger(Documents.name);

  constructor(
    private readonly documentsService: DocumentsService,
    private readonly gcsService: GcsService,
    private readonly tokenExchangeService: TokenExchangeService,
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

    server.registerTool(
      'list_gcs_bucket',
      {
        title: 'List GCS bucket contents',
        description: 'Lists the contents of a Google Cloud Storage bucket using token exchange',
        inputSchema: {
          type: 'object',
          properties: {
            bucketName: {
              type: 'string',
              description: 'Optional: The name of the GCS bucket to list. If not provided, uses the default configured bucket.',
            },
          },
        },
      },
      async (params: { bucketName?: string }) => {
        try {
          // Exchange the MCP token for a Google token
          const tokenResponse = await this.tokenExchangeService.exchangeToken(auth.token);

          // List the bucket contents using the exchanged token
          const files = await this.gcsService.listBucketContents(
            tokenResponse.access_token,
            params.bucketName
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(files, null, 2),
              }
            ]
          };
        } catch (error) {
          this.logger.error('Error listing GCS bucket:', error);
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
