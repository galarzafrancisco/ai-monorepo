import { Injectable, Logger } from '@nestjs/common';
import { SELF_NAME, SELF_VERSION, TOKEN_EXCHANGE_RESOURCE, TOKEN_EXCHANGE_SCOPE } from '../config/self.config';
import { TOKEN_EXCHANGE_URL } from 'src/config/as.config';

export interface TokenExchangeRequest {
  grant_type: string;
  subject_token: string;
  subject_token_type: string;
  resource: string;
  scope: string;
}

export interface TokenExchangeResponse {
  access_token: string;
  issued_token_type: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

@Injectable()
export class TokenExchangeService {
  private readonly logger = new Logger(TokenExchangeService.name);
  
  async exchangeToken(mcpToken: string): Promise<TokenExchangeResponse> {
    const requestBody: TokenExchangeRequest = {
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: mcpToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      resource: TOKEN_EXCHANGE_RESOURCE,
      scope: TOKEN_EXCHANGE_SCOPE,
    };

    this.logger.debug(`Exchanging token at ${TOKEN_EXCHANGE_URL}`);

    try {
      const response = await fetch(TOKEN_EXCHANGE_URL, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as TokenExchangeResponse;
      this.logger.debug('Token exchange successful');
      return data;
    } catch (error) {
      this.logger.error('Token exchange error:', error);
      throw error;
    }
  }
}
