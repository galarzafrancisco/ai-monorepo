import { AccessTokenClaims } from '../../../auth/core/types/access-token-claims.type';
import { ActorType } from 'src/identity-provider/enums';

export type AuthContext = {
  token: string;
  claims: AccessTokenClaims;
  scopes: string[];
  subject: string;
  /**
   * The workspace this request works in: the token's `workspace_id` claim,
   * or the default workspace for tokens minted before workspaces existed.
   * See docs/architecture/workspaces.md.
   */
  workspaceId: string;
};

// Quick and dirty type to expose via the user @CurrentUser
export type UserContext = {
  actorId: string;
  actorSlug: string;
  actorType: ActorType;
};
