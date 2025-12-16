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
}
