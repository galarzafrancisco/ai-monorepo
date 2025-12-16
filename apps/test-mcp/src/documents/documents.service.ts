import { Injectable, Logger } from '@nestjs/common';
import { GcsService } from './gcs.service';
import { TokenExchangeService } from '../auth/token-exchange.service';
import { BUCKET_NAME } from 'src/config/gcp.config';

@Injectable()
export class DocumentsService {
  private logger = new Logger(DocumentsService.name);

  constructor(
    private readonly gcsService: GcsService,
    private readonly tokenExchangeService: TokenExchangeService,
  ) {}

  async listDocuments(token: string): Promise<any[]> {
    // Exchange the MCP token for a Google token
    const tokenResponse = await this.tokenExchangeService.exchangeToken(token);

    // List the bucket contents using the exchanged token
    const files = await this.gcsService.listBucketContents(
      tokenResponse.access_token,
      BUCKET_NAME,
    );

    return files;
  }

  async readDocument(token: string, fileName: string): Promise<string> {
    // Exchange the MCP token for a Google token
    const tokenResponse = await this.tokenExchangeService.exchangeToken(token);

    // Read the file using the exchanged token
    const content = await this.gcsService.readFile(
      tokenResponse.access_token,
      fileName,
      BUCKET_NAME,
    );

    return content;
  }

  async uploadDocument(token: string, fileName: string, content: string): Promise<void> {
    // Exchange the MCP token for a Google token
    const tokenResponse = await this.tokenExchangeService.exchangeToken(token);

    // Upload the file using the exchanged token
    await this.gcsService.uploadFile(
      tokenResponse.access_token,
      fileName,
      content,
      BUCKET_NAME,
    );
  }
}
