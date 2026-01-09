// src/auth/context/auth-context.types.ts
import { McpJwtPayload } from "src/authorization-server/types";

export type AccessTokenClaims = McpJwtPayload;

export type AuthContext = {
  token: string;
  claims: AccessTokenClaims;
  scopes: string[];
  subject?: string;
};
