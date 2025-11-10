import {
  Controller,
  Get
} from '@nestjs/common';
import { AUTHORIZATION_SERVER_URL } from 'src/config/as.config';

@Controller('.well-known')
export class DiscoveryController {
  @Get('oauth-protected-resource')
  async getProtectedResource() {
    return {
      "issuer": AUTHORIZATION_SERVER_URL,
    }
  }
}