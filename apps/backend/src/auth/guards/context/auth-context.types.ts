import { AccessTokenClaims } from "../../../auth/core/types/access-token-claims.type";

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