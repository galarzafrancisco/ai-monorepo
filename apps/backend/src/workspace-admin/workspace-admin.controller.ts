import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import { CurrentWorkspace } from '../auth/guards/decorators/current-workspace.decorator';
import { WorkspaceAccess } from '../auth/guards/decorators/workspace-access.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { InstallationScopes } from '../auth/core/scopes/installation.scopes';
import { UserScopes } from '../auth/core/scopes/user.scopes';
import { WorkspaceRole } from '../workspaces/enums';
import { NotInWorkspaceError } from '../workspaces/workspace.errors';
import {
  WorkspaceMemberResult,
  WorkspacesService,
} from '../workspaces/workspaces.service';
import { WorkspaceAdminService } from './workspace-admin.service';
import { WorkspaceInvitationsService } from './workspace-invitations.service';
import { WorkspaceInvitationEntity } from '../workspaces/workspace-invitation.entity';
import { Public } from '../auth/guards/decorators/public.decorator';
import { getFrontendPath } from '../config/frontend.config';
import {
  CreateWorkspaceRequestDto,
  InviteWorkspaceMemberRequestDto,
  InviteWorkspaceMemberResponseDto,
  InvitationCodeRequestDto,
  InvitationPreviewResponseDto,
  AcceptInvitationResponseDto,
  AcceptInvitationNewAccountRequestDto,
  WorkspaceInvitationResponseDto,
  LocateRowQueryDto,
  UpdateWorkspaceMemberRequestDto,
  WorkspaceMemberResponseDto,
  WorkspaceResponseDto,
} from './dto/http/workspace.dto';

/**
 * Workspaces and their members. Listing your own workspaces and creating one
 * are not about any one workspace (`installation`). Members are always those
 * of the token's workspace (`/workspaces/current/...`): there is no workspace
 * id in URLs. See docs/architecture/workspaces.md.
 */
@ApiTags('Workspaces')
@ApiCookieAuth('JWT-Cookie')
@Controller('workspaces')
@UseGuards(AccessTokenGuard, ScopesGuard)
export class WorkspaceAdminController {
  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly workspaceAdminService: WorkspaceAdminService,
    private readonly invitationsService: WorkspaceInvitationsService,
  ) {}

  @Get()
  @WorkspaceAccess('installation')
  @ApiOperation({ summary: 'List the workspaces you are a member of' })
  @ApiOkResponse({ type: [WorkspaceResponseDto] })
  async listMine(
    @CurrentUser() user: UserContext,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<WorkspaceResponseDto[]> {
    const memberships = await this.workspacesService.listWorkspacesForActor(
      user.actorId,
    );
    return memberships.map((m) => ({
      id: m.workspaceId,
      slug: m.slug,
      name: m.name,
      role: m.role,
      current: m.workspaceId === workspaceId,
    }));
  }

  @Get('locate')
  @WorkspaceAccess('installation')
  @ApiOperation({
    summary: 'Find which of your workspaces a task, thread or context block is in',
    description:
      'For links to a row of another workspace: the UI offers to switch instead of showing not found. A row that does not exist and one in a workspace you are not in both answer 404.',
  })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  async locate(
    @CurrentUser() user: UserContext,
    @CurrentWorkspace() workspaceId: string,
    @Query() query: LocateRowQueryDto,
  ): Promise<WorkspaceResponseDto> {
    const membership = await this.workspacesService.locateRowForActor(
      user.actorId,
      query.kind,
      query.id,
    );
    if (!membership) {
      throw new NotInWorkspaceError();
    }
    return {
      id: membership.workspaceId,
      slug: membership.slug,
      name: membership.name,
      role: membership.role,
      current: membership.workspaceId === workspaceId,
    };
  }

  @Post()
  @WorkspaceAccess('installation')
  @RequireScopes(InstallationScopes.ADMIN.id)
  @ApiOperation({
    summary: 'Installation operator: create a workspace',
    description:
      'You become its admin. It starts with the system tags, the taico agent and unconfigured AI providers. Switch to it to work in it.',
  })
  @ApiCreatedResponse({ type: WorkspaceResponseDto })
  async create(
    @CurrentUser() user: UserContext,
    @Body() dto: CreateWorkspaceRequestDto,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.workspaceAdminService.createWorkspace(
      user.actorId,
      { name: dto.name, slug: dto.slug },
    );
    return {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      role: WorkspaceRole.ADMIN,
      current: false,
    };
  }

  @Get('current')
  @WorkspaceAccess('scoped')
  @ApiOperation({ summary: "The token's workspace, with your role in it" })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  async getCurrent(
    @CurrentUser() user: UserContext,
    @CurrentWorkspace() workspaceId: string,
  ): Promise<WorkspaceResponseDto> {
    const [workspace, role] = await Promise.all([
      this.workspacesService.findWorkspace(workspaceId),
      this.workspacesService.findRole(workspaceId, user.actorId),
    ]);
    if (!workspace || !role) {
      throw new NotInWorkspaceError();
    }
    return {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      role,
      current: true,
    };
  }

  @Get('current/members')
  @WorkspaceAccess('scoped')
  @ApiOperation({ summary: 'List the members (people and agents) of your workspace' })
  @ApiOkResponse({ type: [WorkspaceMemberResponseDto] })
  async listMembers(
    @CurrentWorkspace() workspaceId: string,
  ): Promise<WorkspaceMemberResponseDto[]> {
    const members = await this.workspacesService.listMembers(workspaceId);
    return members.map(toMemberDto);
  }

  @Post('current/members')
  @WorkspaceAccess('scoped')
  @RequireScopes(UserScopes.ADMIN.id)
  @ApiOperation({
    summary: 'Workspace admin: invite a person by email',
    description:
      'Creates an invitation with a one-time code; nobody is added until the person accepts it with that code. The answer is the same whether or not the email has an account.',
  })
  @ApiCreatedResponse({ type: InviteWorkspaceMemberResponseDto })
  async invite(
    @CurrentWorkspace() workspaceId: string,
    @CurrentUser() user: UserContext,
    @Body() dto: InviteWorkspaceMemberRequestDto,
  ): Promise<InviteWorkspaceMemberResponseDto> {
    const { invitation, code } = await this.invitationsService.invite({
      workspaceId,
      invitedByActorId: user.actorId,
      email: dto.email,
      role: dto.role,
    });
    return {
      invitation: toInvitationDto(invitation),
      inviteCode: code,
      inviteUrl: getFrontendPath(`/invite?code=${encodeURIComponent(code)}`),
    };
  }

  @Get('current/invitations')
  @WorkspaceAccess('scoped')
  @RequireScopes(UserScopes.ADMIN.id)
  @ApiOperation({ summary: 'Workspace admin: invitations not yet accepted' })
  @ApiOkResponse({ type: [WorkspaceInvitationResponseDto] })
  async listInvitations(
    @CurrentWorkspace() workspaceId: string,
  ): Promise<WorkspaceInvitationResponseDto[]> {
    return (await this.invitationsService.listOpen(workspaceId)).map(toInvitationDto);
  }

  @Delete('current/invitations/:invitationId')
  @WorkspaceAccess('scoped')
  @RequireScopes(UserScopes.ADMIN.id)
  @HttpCode(204)
  @ApiOperation({ summary: 'Workspace admin: revoke an invitation' })
  async revokeInvitation(
    @CurrentWorkspace() workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ): Promise<void> {
    await this.invitationsService.revoke(workspaceId, invitationId);
  }

  @Post('invitations/preview')
  @Public()
  @HttpCode(200)
  @ApiOperation({
    summary: 'What an invitation is for, to whoever holds its code',
    description: 'A wrong, used, revoked or expired code answers 404.',
  })
  @ApiOkResponse({ type: InvitationPreviewResponseDto })
  async previewInvitation(@Body() dto: InvitationCodeRequestDto): Promise<InvitationPreviewResponseDto> {
    const preview = await this.invitationsService.preview(dto.code);
    return { ...preview, expiresAt: preview.expiresAt.toISOString() };
  }

  @Post('invitations/accept-new-account')
  @Public()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Accept an invitation by creating the invited account',
    description:
      'Creates the account for the invited email, with this password, in the workspace. Then sign in. If the email already has an account, sign in to it and accept instead (409).',
  })
  @ApiCreatedResponse({ type: AcceptInvitationResponseDto })
  async acceptInvitationWithNewAccount(
    @Body() dto: AcceptInvitationNewAccountRequestDto,
  ): Promise<AcceptInvitationResponseDto> {
    const { workspace } = await this.invitationsService.acceptWithNewAccount(dto.code, {
      displayName: dto.displayName,
      slug: dto.slug,
      password: dto.password,
    });
    return workspace;
  }

  @Post('invitations/accept')
  @WorkspaceAccess('installation')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Accept an invitation as the signed-in person',
    description:
      'The account must have the invited email. Joins the workspace; switch to it to work there.',
  })
  @ApiOkResponse({ type: AcceptInvitationResponseDto })
  async acceptInvitation(
    @CurrentUser() user: UserContext,
    @Body() dto: InvitationCodeRequestDto,
  ): Promise<AcceptInvitationResponseDto> {
    return this.invitationsService.acceptAsActor(dto.code, user.actorId);
  }

  @Patch('current/members/:actorId')
  @WorkspaceAccess('scoped')
  @RequireScopes(UserScopes.ADMIN.id)
  @ApiOperation({
    summary: "Workspace admin: change a person's role",
    description: 'Takes effect in their next token. The last admin cannot be demoted.',
  })
  @ApiOkResponse({ type: WorkspaceMemberResponseDto })
  async updateMember(
    @CurrentWorkspace() workspaceId: string,
    @Param('actorId', ParseUUIDPipe) actorId: string,
    @Body() dto: UpdateWorkspaceMemberRequestDto,
  ): Promise<WorkspaceMemberResponseDto> {
    return toMemberDto(
      await this.workspacesService.setMemberRole(workspaceId, actorId, dto.role),
    );
  }

  @Delete('current/members/:actorId')
  @WorkspaceAccess('scoped')
  @RequireScopes(UserScopes.ADMIN.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Workspace admin: remove a person from the workspace',
    description:
      'They lose access at their next token: tokens already minted stay valid until they expire. The last admin cannot be removed; agents are deleted, not removed.',
  })
  @ApiNoContentResponse()
  async removeMember(
    @CurrentWorkspace() workspaceId: string,
    @Param('actorId', ParseUUIDPipe) actorId: string,
  ): Promise<void> {
    await this.workspacesService.removeMember(workspaceId, actorId);
  }
}

function toMemberDto(member: WorkspaceMemberResult): WorkspaceMemberResponseDto {
  return {
    actorId: member.actorId,
    type: member.type,
    slug: member.slug,
    displayName: member.displayName,
    avatarUrl: member.avatarUrl,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  };
}

function toInvitationDto(invitation: WorkspaceInvitationEntity): WorkspaceInvitationResponseDto {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}
