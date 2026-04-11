import { ApiClient } from '@taico/client/v2';
import { BFF_BASE_URL } from '../../config/api';

const baseUrl = BFF_BASE_URL || window.location.origin;

const client = new ApiClient({
  baseUrl,
  credentials: 'include',
});

export const AuthorizationServerService = client.authorizationServer;

// Re-export types for convenience
export type { ConsentDecisionDto, GetConsentMetadataResponseDto } from '@taico/client/v2';
