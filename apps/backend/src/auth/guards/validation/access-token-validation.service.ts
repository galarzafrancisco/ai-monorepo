import { Injectable } from '@nestjs/common';
import { AccessTokenClaims } from '../../core/types/access-token-claims.type';
import { TokenVerifierService } from '../../crypto/token-verifier.service';
import { WorkspaceMembershipGate } from '../../../workspaces/workspace-membership.gate';
import { WorkspaceMembershipRevokedError } from '../../../workspaces/workspace.errors';
import type { AuthContext } from '../context/auth-context.types';

/**
 * Validates access tokens (signature, issuer, expiry) and checks that a
 * token's actor is still a member of its workspace.
 */
@Injectable()
export class AccessTokenValidationService {
  constructor(
    private readonly tokenVerifierService: TokenVerifierService,
    private readonly membershipGate: WorkspaceMembershipGate,
  ) {}

  async validateAccessToken(token: string): Promise<AccessTokenClaims> {
    // Decode token (verifies signature, expiry and issuer)
    const jwt = this.tokenVerifierService.verifyAndDecode(token);
    // If any additional validation, do it here.
    return jwt;
  }

  /**
   * Refuses a token whose actor was removed from its workspace after it was
   * minted. Called for every request to workspace data.
   *
   * @throws {WorkspaceMembershipRevokedError}
   */
  async assertWorkspaceMember(auth: AuthContext): Promise<void> {
    if (!(await this.membershipGate.isMember(auth))) {
      throw new WorkspaceMembershipRevokedError();
    }
  }
}
