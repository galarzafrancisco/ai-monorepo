export type ToolAuthType = 'taico' | 'external';
export type ToolTransport = 'http' | 'stdio';

/** Whether the "Use Taico authentication" switch is on for a tool. Missing means Taico. */
export function usesTaicoAuth(tool: { authType?: ToolAuthType | null } | null | undefined): boolean {
  return (tool?.authType ?? 'taico') === 'taico';
}

/** The auth type a switch position stands for. */
export function authTypeFromSwitch(useTaicoAuth: boolean): ToolAuthType {
  return useTaicoAuth ? 'taico' : 'external';
}

/**
 * The auth type to register a new tool with. Only HTTP servers get
 * credentials, so stdio servers keep the default.
 */
export function authTypeForNewTool(type: ToolTransport, useTaicoAuth: boolean): ToolAuthType {
  return type === 'http' ? authTypeFromSwitch(useTaicoAuth) : 'taico';
}
