import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { IdentityProviderService } from '../identity-provider/identity-provider.service';
import { User } from '../identity-provider/user.entity';
import { WorkspaceRole } from '../workspaces/enums';
import { WorkspaceInvitationEntity } from '../workspaces/workspace-invitation.entity';
import {
  WorkspaceInvitationAccountExistsError,
  WorkspaceInvitationEmailMismatchError,
  WorkspaceInvitationNotFoundError,
  WorkspaceMemberAlreadyExistsError,
} from '../workspaces/workspace.errors';
import { WorkspacesService } from '../workspaces/workspaces.service';

/** How long an invitation code stays valid. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();

export type InvitationWorkspace = {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  role: WorkspaceRole;
};

/**
 * Workspace invitations. An invite adds nobody, whether or not the email has
 * an account: it is accepted with its one-time code, which the inviting admin
 * gives the person. So nobody joins a workspace because someone else typed
 * their email, and an account claimed by someone else under the same email
 * can't take an invitation it was never given.
 * See docs/architecture/workspaces.md, "Invitations".
 */
@Injectable()
export class WorkspaceInvitationsService {
  private readonly logger = new Logger(WorkspaceInvitationsService.name);

  constructor(
    @InjectRepository(WorkspaceInvitationEntity)
    private readonly invitations: Repository<WorkspaceInvitationEntity>,
    private readonly workspacesService: WorkspacesService,
    private readonly identityProviderService: IdentityProviderService,
  ) {}

  /**
   * Creates an invitation and returns its one-time code (only its hash is
   * stored). Inviting the same email again replaces the open invitation.
   *
   * @throws {WorkspaceMemberAlreadyExistsError} if the email's account is
   *   already a member of this workspace.
   */
  async invite(input: {
    workspaceId: string;
    invitedByActorId: string;
    email: string;
    role: WorkspaceRole;
  }): Promise<{ invitation: WorkspaceInvitationEntity; code: string }> {
    const email = normalizeEmail(input.email);
    const user = await this.identityProviderService.getUserByEmail(email);
    if (user && (await this.workspacesService.isMember(input.workspaceId, user.actorId))) {
      throw new WorkspaceMemberAlreadyExistsError(user.actorId);
    }
    await this.invitations.delete({ workspaceId: input.workspaceId, email, acceptedAt: IsNull() });
    const code = randomBytes(24).toString('base64url');
    const invitation = await this.invitations.save(
      this.invitations.create({
        workspaceId: input.workspaceId,
        email,
        role: input.role,
        codeHash: sha256(code),
        invitedByActorId: input.invitedByActorId,
        expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
        acceptedAt: null,
        acceptedByActorId: null,
      }),
    );
    return { invitation, code };
  }

  /** The workspace's invitations that can still be accepted. */
  listOpen(workspaceId: string): Promise<WorkspaceInvitationEntity[]> {
    return this.invitations.find({
      where: { workspaceId, acceptedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      order: { createdAt: 'DESC' },
    });
  }

  /** @throws {WorkspaceInvitationNotFoundError} if it isn't an open invitation of this workspace. */
  async revoke(workspaceId: string, invitationId: string): Promise<void> {
    const result = await this.invitations.delete({ workspaceId, id: invitationId, acceptedAt: IsNull() });
    if (!result.affected) {
      throw new WorkspaceInvitationNotFoundError();
    }
  }

  /** What an invitation is for, to whoever holds its code. */
  async preview(code: string): Promise<InvitationWorkspace & { email: string; expiresAt: Date; accountExists: boolean }> {
    const invitation = await this.findOpen(code);
    const workspace = await this.workspace(invitation);
    return {
      ...workspace,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      accountExists: Boolean(await this.identityProviderService.getUserByEmail(invitation.email)),
    };
  }

  /**
   * Accepts an invitation as a signed-in person, whose account must have the
   * invited email.
   *
   * @throws {WorkspaceInvitationNotFoundError} for a wrong, used, revoked or expired code.
   * @throws {WorkspaceInvitationEmailMismatchError} for another account.
   */
  async acceptAsActor(code: string, actorId: string): Promise<InvitationWorkspace> {
    const invitation = await this.findOpen(code);
    const user = await this.identityProviderService.getUserByActorId(actorId);
    if (!user || normalizeEmail(user.email) !== invitation.email) {
      throw new WorkspaceInvitationEmailMismatchError();
    }
    await this.claim(invitation, actorId, async () => {
      try {
        await this.workspacesService.addMember(invitation.workspaceId, actorId, invitation.role);
      } catch (error) {
        // Already a member: accepting again changes nothing.
        if (!(error instanceof WorkspaceMemberAlreadyExistsError)) throw error;
      }
    });
    return this.workspace(invitation);
  }

  /**
   * Accepts an invitation by creating the account it was sent to, with the
   * password the person chooses. Nothing is created before this, so there is
   * no pending account for anyone else to claim.
   *
   * @throws {WorkspaceInvitationNotFoundError} for a wrong, used, revoked or expired code.
   * @throws {WorkspaceInvitationAccountExistsError} if the email has an
   *   account: sign in to it and accept instead.
   */
  async acceptWithNewAccount(
    code: string,
    account: { displayName: string; slug: string; password: string },
  ): Promise<{ user: User; workspace: InvitationWorkspace }> {
    const invitation = await this.findOpen(code);
    if (await this.identityProviderService.getUserByEmail(invitation.email)) {
      throw new WorkspaceInvitationAccountExistsError();
    }
    let user: User | undefined;
    await this.claim(invitation, null, async () => {
      user = await this.identityProviderService.createUser({
        email: invitation.email,
        displayName: account.displayName,
        slug: account.slug,
        password: account.password,
        workspace: { workspaceId: invitation.workspaceId, role: invitation.role },
      });
      await this.invitations.update({ id: invitation.id }, { acceptedByActorId: user.actorId });
    });
    return { user: user!, workspace: await this.workspace(invitation) };
  }

  private async findOpen(code: string): Promise<WorkspaceInvitationEntity> {
    const invitation = await this.invitations.findOne({
      where: { codeHash: sha256(code), acceptedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (!invitation) {
      throw new WorkspaceInvitationNotFoundError();
    }
    return invitation;
  }

  /**
   * Uses the invitation up atomically (one UPDATE that only matches an open
   * invitation), then runs `join`. If `join` fails, the invitation is open again.
   */
  private async claim(
    invitation: WorkspaceInvitationEntity,
    actorId: string | null,
    join: () => Promise<void>,
  ): Promise<void> {
    const claimed = await this.invitations
      .createQueryBuilder()
      .update()
      .set({ acceptedAt: () => 'now()', acceptedByActorId: actorId })
      .where('id = :id AND accepted_at IS NULL AND expires_at > now()', { id: invitation.id })
      .execute();
    if (!claimed.affected) {
      throw new WorkspaceInvitationNotFoundError();
    }
    try {
      await join();
    } catch (error) {
      await this.invitations.update({ id: invitation.id }, { acceptedAt: null, acceptedByActorId: null });
      throw error;
    }
  }

  private async workspace(invitation: WorkspaceInvitationEntity): Promise<InvitationWorkspace> {
    const workspace = await this.workspacesService.findWorkspace(invitation.workspaceId);
    if (!workspace || workspace.deletedAt) {
      throw new WorkspaceInvitationNotFoundError();
    }
    return {
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.name,
      role: invitation.role,
    };
  }
}
