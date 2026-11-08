import { Injectable, Logger } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { AgentSlugConflictError } from '../agents/errors/agents.errors';
import { AiProvidersService } from '../ai-providers/ai-providers.service';
import { AiProviderType } from '../ai-providers/enums';
import { createTaico } from '../app-init/agent/taico.agent';
import { IdentityProviderService } from '../identity-provider/identity-provider.service';
import { UserRole } from '../identity-provider/enums';
import { MetaService } from '../meta/meta.service';
import { WorkspaceRole } from '../workspaces/enums';
import { WorkspaceEntity } from '../workspaces/workspace.entity';
import {
  WorkspaceMemberResult,
  WorkspacesService,
} from '../workspaces/workspaces.service';

/**
 * Creating workspaces and managing who is in them (phase 4). Membership rules
 * themselves (last admin, agents) live in `WorkspacesService`; this adds what
 * needs other modules: seeding a new workspace and inviting by email.
 */
@Injectable()
export class WorkspaceAdminService {
  private readonly logger = new Logger(WorkspaceAdminService.name);

  constructor(
    private readonly workspacesService: WorkspacesService,
    private readonly identityProviderService: IdentityProviderService,
    private readonly metaService: MetaService,
    private readonly agentsService: AgentsService,
    private readonly aiProvidersService: AiProvidersService,
  ) {}

  /**
   * Creates a workspace with the operator as its admin, and seeds what every
   * workspace starts with.
   */
  async createWorkspace(
    operatorActorId: string,
    input: { name: string; slug: string },
  ): Promise<WorkspaceEntity> {
    const workspace = await this.workspacesService.createWorkspace({
      ...input,
      adminActorId: operatorActorId,
    });
    await this.provision(workspace.id);
    this.logger.log(`Created workspace ${workspace.slug} (${workspace.id})`);
    return workspace;
  }

  /**
   * What a new workspace starts with:
   * - the system tags
   * - the `taico` agent, which runs its threads
   * - the OpenAI and Google Vertex AI providers with no credentials: they are
   *   not configured until a workspace admin adds a key (installation
   *   credentials are the default workspace's only)
   *
   * Idempotent, so it can be run again on a workspace that is part-seeded.
   */
  async provision(workspaceId: string): Promise<void> {
    await this.metaService.ensureSystemTags(workspaceId);

    try {
      await this.agentsService.createAgent(workspaceId, createTaico);
    } catch (error) {
      if (!(error instanceof AgentSlugConflictError)) throw error;
    }

    const providers = await this.aiProvidersService.listAiProviders(workspaceId);
    for (const { type, name } of [
      { type: AiProviderType.OPENAI, name: 'OpenAI' },
      { type: AiProviderType.GOOGLE_VERTEX, name: 'Google Vertex AI' },
    ]) {
      if (!providers.some((p) => p.type === type)) {
        await this.aiProvidersService.createAiProvider(workspaceId, {
          name,
          type,
          secretId: null,
        });
      }
    }
  }

  /**
   * Invites a person by email. Someone with an account is added. Anyone else
   * gets an invited account (installation role `standard`), set up through
   * the usual account setup, and is a member of this workspace only.
   */
  async inviteMember(
    workspaceId: string,
    input: { email: string; role: WorkspaceRole },
  ): Promise<{ member: WorkspaceMemberResult; accountCreated: boolean }> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.identityProviderService.getUserByEmail(email);
    if (existing) {
      return {
        member: await this.workspacesService.addMember(
          workspaceId,
          existing.actorId,
          input.role,
        ),
        accountCreated: false,
      };
    }
    const user = await this.identityProviderService.createManagedUser({
      email,
      role: UserRole.STANDARD,
      workspace: { workspaceId, role: input.role },
    });
    const member = await this.workspacesService.getMember(
      workspaceId,
      user.actorId,
    );
    if (!member) {
      throw new Error(`Invited ${user.actorId} is not a member of ${workspaceId}`);
    }
    return { member, accountCreated: true };
  }
}
