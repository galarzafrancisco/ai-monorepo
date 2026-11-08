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
import {
  CreateWorkspaceRequestDto,
  InviteWorkspaceMemberRequestDto,
  InviteWorkspaceMemberResponseDto,
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
      'A person with an account is added. Anyone else gets an invited account, which they set up through account setup.',
  })
  @ApiCreatedResponse({ type: InviteWorkspaceMemberResponseDto })
  async invite(
    @CurrentWorkspace() workspaceId: string,
    @Body() dto: InviteWorkspaceMemberRequestDto,
  ): Promise<InviteWorkspaceMemberResponseDto> {
    const { member, accountCreated } =
      await this.workspaceAdminService.inviteMember(workspaceId, {
        email: dto.email,
        role: dto.role,
      });
    return { member: toMemberDto(member), accountCreated };
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
