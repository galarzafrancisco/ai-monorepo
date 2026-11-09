import { Injectable, Logger } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';
import { AgentSlugConflictError } from '../agents/errors/agents.errors';
import { AiProvidersService } from '../ai-providers/ai-providers.service';
import { AiProviderType } from '../ai-providers/enums';
import { SEEDED_AGENTS } from '../app-init/agent/seeded-agents';
import { PROTECTED_AGENT_SLUGS } from '../agents/protected-agents';
import { ActorService } from '../identity-provider/actor.service';
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
    private readonly actorService: ActorService,
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
   * - the built-in agents (`SEEDED_AGENTS`): the `taico` agent, which runs
   *   its threads, and the developer, reviewer, planner and other agents the
   *   default workspace starts with
   * - the OpenAI and Google Vertex AI providers with no credentials: they are
   *   not configured until a workspace admin adds a key (installation
   *   credentials are the default workspace's only)
   *
   * Idempotent, so it can be run again on a workspace that is part-seeded.
   */
  async provision(workspaceId: string): Promise<void> {
    await this.metaService.ensureSystemTags(workspaceId);

    for (const { seed } of SEEDED_AGENTS) {
      // Run again on a part-seeded workspace, a built-in agent its admins
      // deleted stays deleted. The threads agent cannot be deleted.
      if (
        !PROTECTED_AGENT_SLUGS.includes(seed.slug) &&
        (await this.actorService.hasDeletedActorForSlug(workspaceId, seed.slug))
      ) {
        continue;
      }
      try {
        await this.agentsService.createAgent(workspaceId, seed);
      } catch (error) {
        if (!(error instanceof AgentSlugConflictError)) throw error;
      }
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

}
