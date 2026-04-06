import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { AgentsService } from 'src/agents/agents.service';
import { createClaudeDev } from './agent/claude-dev.agent';
import { McpRegistryService } from 'src/mcp-registry/mcp-registry.service';
import { createTasks, createTasksScopes } from './mcp/tasks.mcp';
import { CreateServerInput, ServerRecord } from 'src/mcp-registry/dto';
import {
  ServerAlreadyExistsError,
} from 'src/mcp-registry/errors/mcp-registry.errors';
import {
  AgentResult,
  CreateAgentInput,
} from 'src/agents/dto/service/agents.service.types';
import { AgentSlugConflictError } from 'src/agents/errors/agents.errors';
import { createContext, createContextScopes } from './mcp/context.mcp';
import { getConfig } from 'src/config/env.config';
import { devUser, devUserRole } from './user/dev.user';
import { adminUser, adminUserRole } from './user/admin.user';
import { CreateUserInput } from 'src/identity-provider/dto/service/identity-provider.service.types';
import { UserRole, ActorType } from 'src/identity-provider/enums';
import { User } from 'src/identity-provider/user.entity';
import { ActorEntity } from 'src/identity-provider/actor.entity';
import { AgentEntity } from 'src/agents/agent.entity';
import { IdentityProviderService } from 'src/identity-provider/identity-provider.service';
import { Scope } from 'src/auth/core/types/scope.type';
import { createCodexDev } from './agent/codex-dev.agent';
import { createGeminiAssistant } from './agent/gemini-assistant.agent';
import { createCodeReviewer } from './agent/code-reviewer.agent';
import { MetaService } from 'src/meta/meta.service';
import { ContextService } from 'src/context/context.service';
import { DEV_PROMPT, ASSISTANT_PROMPT, REVIEWER_PROMPT } from './agent/prompts';
import { createQwen3CoderNext } from './agent/qwen3-coder-next';
import { createTaico } from './agent/taico.agent';
import { createPlaywright } from './mcp/playwright.mcp';
import { createElen } from './mcp/elen.mcp';
import { ChatProvidersService } from 'src/chat-providers/chat-providers.service';
import { ChatProviderType } from 'src/chat-providers/enums';
import {
  createInternalWorkerAuthScopes,
  createInternalWorkerAuthTarget,
} from './mcp/internal-worker-auth.mcp';

@Injectable()
export class AppInitRunner implements OnApplicationBootstrap {
  private logger = new Logger(AppInitRunner.name);

  constructor(
    @Inject()
    private readonly agentsService: AgentsService,
    private readonly mcpRegistryService: McpRegistryService,
    private readonly identityProviderService: IdentityProviderService,
    private readonly metaService: MetaService,
    private readonly contextService: ContextService,
    private readonly chatProvidersService: ChatProvidersService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
  ) {}

  async onApplicationBootstrap() {
    const config = getConfig();

    // Run actor migration first (before ensuring users/agents)
    await this.ensureActorMigration();

    await this.ensureAgents();
    await this.ensureMcpServers();
    await this.ensurePromptTag();
    await this.ensurePromptContextBlocks();
    await this.ensureDefaultChatProvider();

    if (config.nodeEnv === 'development') {
      this.ensureUsers();
    }
  }

  /**
   * Migrate existing users and agents to have actor records.
   * This is idempotent - safe to run on every container startup.
   */
  async ensureActorMigration() {
    this.logger.log('Starting actor migration check...');

    // Migrate users without actors
    const usersWithoutActor = await this.userRepository.find({
      where: { actorId: IsNull() },
    });

    if (usersWithoutActor.length > 0) {
      this.logger.log(
        `Found ${usersWithoutActor.length} users without actors, migrating...`,
      );
      for (const user of usersWithoutActor) {
        try {
          // Check if an actor with this slug already exists
          let actor = await this.actorRepository.findOne({
            where: { slug: user.email },
          });

          if (!actor) {
            actor = this.actorRepository.create({
              type: ActorType.HUMAN,
              slug: user.email,
              displayName: user.email, // Use email as display name for migrated users
              avatarUrl: null,
            });
            actor = await this.actorRepository.save(actor);
            this.logger.log(`Created actor for user: ${user.email}`);
          }

          user.actorId = actor.id;
          await this.userRepository.save(user);
          this.logger.log(`Linked user ${user.email} to actor ${actor.id}`);
        } catch (error) {
          this.logger.error(`Failed to migrate user ${user.email}`);
        }
      }
    }

    // Migrate agents without actors
    const agentsWithoutActor = await this.agentRepository.find({
      where: { actorId: IsNull() },
    });

    if (agentsWithoutActor.length > 0) {
      this.logger.log(
        `Found ${agentsWithoutActor.length} agents without actors, migrating...`,
      );
      for (const agent of agentsWithoutActor) {
        try {
          // Check if an actor with this slug already exists
          let actor = await this.actorRepository.findOne({
            where: { slug: agent.slug },
          });

          if (!actor) {
            actor = this.actorRepository.create({
              type: ActorType.AGENT,
              slug: agent.slug,
              displayName: agent.slug, // Use slug as display name for migrated agents
              avatarUrl: null,
            });
            actor = await this.actorRepository.save(actor);
            this.logger.log(`Created actor for agent: ${agent.slug}`);
          }

          agent.actorId = actor.id;
          await this.agentRepository.save(agent);
          this.logger.log(`Linked agent ${agent.slug} to actor ${actor.id}`);
        } catch (error) {
          this.logger.error(`Failed to migrate agent ${agent.slug}`);
        }
      }
    }

    this.logger.log('Actor migration check completed.');
  }

  async ensureAgents() {
    // Create agents
    try {
      await this.ensureAgentExists(createTaico);
    } catch (error) {
      this.logger.error('Error ensuring taico Agent exists');
    }
    try {
      await this.ensureAgentExists(createClaudeDev);
    } catch (error) {
      this.logger.error('Error ensuring claude-dev Agent exists');
    }
    try {
      await this.ensureAgentExists(createCodexDev);
    } catch (error) {
      this.logger.error('Error ensuring codex-dev Agent exists');
    }
    try {
      await this.ensureAgentExists(createGeminiAssistant);
    } catch (error) {
      this.logger.error('Error ensuring gemini-assistant Agent exists');
    }
    try {
      await this.ensureAgentExists(createCodeReviewer);
    } catch (error) {
      this.logger.error('Error ensuring code-reviewer Agent exists');
    }
    try {
      await this.ensureAgentExists(createQwen3CoderNext);
    } catch (error) {
      this.logger.error('Error ensuring qwen3-coder-next Agent exists');
    }
  }

  async ensureMcpServers() {
    try {
      await this.ensureMcpServerExists(
        createInternalWorkerAuthTarget(),
        createInternalWorkerAuthScopes,
      );
    } catch (error) {
      this.logger.error('Error ensuring internal worker auth target exists');
    }
    try {
      await this.ensureMcpServerExists(createTasks(), createTasksScopes);
    } catch (error) {
      this.logger.error('Error ensuring Tasks MCP Server exists');
    }
    try {
      await this.ensureMcpServerExists(createContext(), createContextScopes);
    } catch (error) {
      this.logger.error('Error ensuring Context MCP Server exists');
    }
    try {
      await this.ensureMcpServerExists(createPlaywright, []);
    } catch (error) {
      this.logger.error('Error ensuring Playwright MCP Server exists');
    }
    try {
      await this.ensureMcpServerExists(createElen, []);
    } catch (error) {
      this.logger.error('Error ensuring Elen MCP Server exists');
    }
  }

  async ensureUsers() {
    try {
      await this.ensureUserExists(adminUser, adminUserRole);
    } catch (error) {
      this.logger.error('Error ensuring admin user exists');
    }
    try {
      await this.ensureUserExists(devUser, devUserRole);
    } catch (error) {
      this.logger.error('Error ensuring dev user exists');
    }
  }

  async ensureAgentExists(
    agentConfig: CreateAgentInput,
  ): Promise<AgentResult | null> {
    let agent: AgentResult | null = null;
    try {
      agent = await this.agentsService.createAgent(agentConfig);
    } catch (error) {
      if (error instanceof AgentSlugConflictError) {
        agent = await this.agentsService.getAgentBySlug({
          slug: agentConfig.slug,
        });
        // TODO: rework the update method
        // agent = await this.agentsService.updateAgent(agent.id, createClaudeDev);
      } else {
        throw error;
      }
    }
    return agent;
  }

  async ensureMcpServerExists(
    serverConfig: CreateServerInput,
    scopesConfig: Scope[],
  ): Promise<ServerRecord | null> {
    let server: ServerRecord | null = null;
    try {
      server = await this.mcpRegistryService.createServer(serverConfig);
    } catch (error) {
      if (error instanceof ServerAlreadyExistsError) {
        server = await this.mcpRegistryService.getServerByProvidedId(
          serverConfig.providedId,
        );
        if (
          server.name != serverConfig.name ||
          server.description != serverConfig.description ||
          server.type != serverConfig.type ||
          server.url != serverConfig.url ||
          server.cmd != serverConfig.cmd ||
          JSON.stringify(server.args ?? []) != JSON.stringify(serverConfig.args ?? [])
        ) {
          server = await this.mcpRegistryService.updateServer(server.id, {
            name: serverConfig.name,
            description: serverConfig.description,
            type: serverConfig.type,
            url: serverConfig.url,
            cmd: serverConfig.cmd,
            args: serverConfig.args,
          });
        }
      } else {
        throw error;
      }
    }
    if (server.type === 'http') {
      await this.ensureMcpServerScopes(server, scopesConfig);
    }
    return server;
  }

  private async ensureMcpServerScopes(
    server: ServerRecord,
    scopesConfig: Scope[],
  ): Promise<void> {
    this.logger.log(`Ensuring scopes for MCP Server ${server.name}`);

    const existingScopes = await this.mcpRegistryService.listScopesByServer(
      server.id,
    );
    const existingScopeIds = new Set(existingScopes.map((scope) => scope.id));
    const missingScopes = scopesConfig.filter(
      (scope) => !existingScopeIds.has(scope.id),
    );

    if (missingScopes.length === 0) {
      this.logger.log(`Scopes already exist for MCP Server ${server.name}`);
      return;
    }

    await this.mcpRegistryService.createScopes(server.id, missingScopes);
    this.logger.log(
      `Added ${missingScopes.length} missing scope(s) for MCP Server ${server.name}`,
    );
  }

  async ensureUserExists(
    userConfig: CreateUserInput,
    userRole: UserRole,
  ): Promise<User | null> {
    let user: User | null = null;
    try {
      user = await this.identityProviderService.createUser(userConfig);
    } catch (error) {
      // Maybe user already exists? Fetch
      try {
        user = await this.identityProviderService.getUserByEmail(userConfig.email);
      } catch (error2) {
        this.logger.log("Failed to create user");
        throw error;
      }
    }
    if (!user) {
      return user
    }

    // update role
    try {
      await this.identityProviderService.updateUserRole(user.id, {role: userRole});
    } catch (error) {
      this.logger.log("Failed to update user role");
    }
    return user;
  }

  async ensurePromptTag(): Promise<void> {
    try {
      this.logger.log('Ensuring prompt tag exists');
      await this.metaService.createTag({ name: 'prompt' });
      this.logger.log('Prompt tag ensured');
    } catch (error) {
      this.logger.error('Error ensuring prompt tag exists');
    }
  }

  async ensurePromptContextBlocks(): Promise<void> {
    try {
      this.logger.log('Ensuring prompt context blocks exist');

      // Check if developer prompt already exists
      const existingPages = await this.contextService.listBlocks({
        tag: 'prompt',
      });
      const devPromptExists = existingPages.some(
        (page) => page.title === 'Developer Agent Prompt',
      );
      const assistantPromptExists = existingPages.some(
        (page) => page.title === 'Personal Assistant Prompt',
      );
      const reviewerPromptExists = existingPages.some(
        (page) => page.title === 'Code Reviewer Prompt',
      );

      if (!devPromptExists) {
        this.logger.log('Creating developer agent prompt context block');
        await this.contextService.createBlock({
          title: 'Developer Agent Prompt',
          content: DEV_PROMPT,
          createdByActorId: 'system',
          tagNames: ['prompt'],
        });
        this.logger.log('Developer agent prompt context block created');
      }

      if (!assistantPromptExists) {
        this.logger.log('Creating personal assistant prompt context block');
        await this.contextService.createBlock({
          title: 'Personal Assistant Prompt',
          content: ASSISTANT_PROMPT,
          createdByActorId: 'system',
          tagNames: ['prompt'],
        });
        this.logger.log('Personal assistant prompt context block created');
      }

      if (!reviewerPromptExists) {
        this.logger.log('Creating code reviewer prompt context block');
        await this.contextService.createBlock({
          title: 'Code Reviewer Prompt',
          content: REVIEWER_PROMPT,
          createdByActorId: 'system',
          tagNames: ['prompt'],
        });
        this.logger.log('Code reviewer prompt context block created');
      }

      this.logger.log('Prompt context blocks ensured');
    } catch (error) {
      this.logger.error('Error ensuring prompt context blocks exist');
    }
  }

  async ensureDefaultChatProvider(): Promise<void> {
    try {
      this.logger.log('Ensuring default OpenAI chat provider exists');

      const existingProviders = await this.chatProvidersService.listChatProviders();
      const openAiProviderExists = existingProviders.some(
        (provider) => provider.type === ChatProviderType.OPENAI,
      );

      if (!openAiProviderExists) {
        this.logger.log('Creating default OpenAI chat provider');
        await this.chatProvidersService.createChatProvider({
          name: 'OpenAI',
          type: ChatProviderType.OPENAI,
          secretId: null,
        });
        this.logger.log('Default OpenAI chat provider created');
      }

      this.logger.log('Default chat provider ensured');
    } catch (error) {
      this.logger.error('Error ensuring default chat provider exists');
    }
  }
}
