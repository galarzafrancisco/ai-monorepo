import { getConfig } from 'src/config/env.config';
import { CreateServerInput } from 'src/mcp-registry/dto';
import {
  INTERNAL_WORKER_AUTH_SCOPES,
  INTERNAL_WORKER_AUTH_TARGET_DESCRIPTION,
  INTERNAL_WORKER_AUTH_TARGET_ID,
  INTERNAL_WORKER_AUTH_TARGET_NAME,
} from 'src/auth/core/constants/internal-auth-target.constant';

const config = getConfig();

export const createInternalWorkerAuthTarget: CreateServerInput = {
  providedId: INTERNAL_WORKER_AUTH_TARGET_ID,
  name: INTERNAL_WORKER_AUTH_TARGET_NAME,
  description: INTERNAL_WORKER_AUTH_TARGET_DESCRIPTION,
  type: 'http',
  url: `${config.issuerUrl}/api/v1`,
};

export const createInternalWorkerAuthScopes = INTERNAL_WORKER_AUTH_SCOPES;
