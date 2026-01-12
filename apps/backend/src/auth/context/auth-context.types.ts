// src/auth/context/auth-context.types.ts
import { McpJwtPayload } from "src/authorization-server/types";

export type AccessTokenClaims = McpJwtPayload;

export type AuthContext = {
  token: string;
  claims: AccessTokenClaims;
  scopes: string[];
  subject: string;
};


// Quick and dirty type to expose via the user @CurrentUser
export type UserContext = {
  id: string;
  email: string;
  displayName: string;
}