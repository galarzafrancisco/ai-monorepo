import {
  Controller,
  Get
} from '@nestjs/common';
import { SCOPE_OPTIONS_METADATA } from '@nestjs/common/constants';
import { AUTHORIZATION_SERVER_URL } from 'src/config/as.config';
import { SELF_NAME, SELF_SCOPES, SELF_URL } from 'src/config/self.config';

@Controller('.well-known')
export class DiscoveryController {
  @Get('oauth-protected-resource')
  async getProtectedResource() {
    return {
      resource: SELF_URL,
      authorization_servers: [AUTHORIZATION_SERVER_URL],
      scopes_supported: SELF_SCOPES.split(','),
      bearer_methods_supported: ["header"],
      resource_name: SELF_NAME, 
    }
  }
}