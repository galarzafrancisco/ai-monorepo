import { getConfig } from 'src/config/env.config';
import { BASELINE_SYSTEM_TOOL_PROVIDED_IDS } from '@taico/shared';

type BaselineProvidedId = (typeof BASELINE_SYSTEM_TOOL_PROVIDED_IDS)[number];

/** Where Taico serves its own baseline MCP servers, under the issuer URL. */
export const BASELINE_SERVER_PATHS: Record<BaselineProvidedId, string> = {
  tasks: '/api/v1/tasks/tasks/mcp',
  context: '/api/v1/context/blocks/mcp',
};

export function isBaselineProvidedId(
  providedId: string,
): providedId is BaselineProvidedId {
  return (BASELINE_SYSTEM_TOOL_PROVIDED_IDS as readonly string[]).includes(
    providedId,
  );
}

/**
 * The URL of a baseline server, built from the installation's issuer URL.
 * It does not come from the registry row, which the default workspace can edit.
 */
export function baselineServerUrl(providedId: BaselineProvidedId): string {
  return `${getConfig().issuerUrl}${BASELINE_SERVER_PATHS[providedId]}`;
}
