import { getConfig } from 'src/config/env.config';
import { CreateServerInput } from 'src/mcp-registry/dto';
import {
  DISPLAY_AUTH_SCOPES,
  DISPLAY_AUTH_TARGET_DESCRIPTION,
  DISPLAY_AUTH_TARGET_ID,
  DISPLAY_AUTH_TARGET_NAME,
  INTERNAL_WORKER_AUTH_SCOPES,
  INTERNAL_WORKER_AUTH_TARGET_DESCRIPTION,
  INTERNAL_WORKER_AUTH_TARGET_ID,
  INTERNAL_WORKER_AUTH_TARGET_NAME,
} from 'src/auth/core/constants/internal-auth-target.constant';

export function createInternalWorkerAuthTarget(): CreateServerInput {
  const config = getConfig();

  return {
    providedId: INTERNAL_WORKER_AUTH_TARGET_ID,
    name: INTERNAL_WORKER_AUTH_TARGET_NAME,
    description: INTERNAL_WORKER_AUTH_TARGET_DESCRIPTION,
    type: 'http',
    url: `${config.issuerUrl}/api/v1`,
  };
}

export const createInternalWorkerAuthScopes = INTERNAL_WORKER_AUTH_SCOPES;

export function createDisplayAuthTarget(): CreateServerInput {
  const config = getConfig();

  return {
    providedId: DISPLAY_AUTH_TARGET_ID,
    name: DISPLAY_AUTH_TARGET_NAME,
    description: DISPLAY_AUTH_TARGET_DESCRIPTION,
    type: 'http',
    url: `${config.issuerUrl}/api/v1`,
  };
}

export const createDisplayAuthScopes = DISPLAY_AUTH_SCOPES;
