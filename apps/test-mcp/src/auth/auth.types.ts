import { McpJwtPayload } from './mcp-jwt-payload.type';

export type AuthContext = {
  token: string;
  payload: McpJwtPayload;
};