import { OpenAPI, WebAuthenticationService, type UserResponseDto } from 'shared';
import { BFF_BASE_URL } from '../config/api';

// Use centralized API configuration
OpenAPI.BASE = BFF_BASE_URL;

export { WebAuthenticationService };

/**
 * Re-export UserResponseDto as AuthUser for backward compatibility
 */
export type AuthUser = UserResponseDto;
