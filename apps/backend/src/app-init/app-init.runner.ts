import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull } from "typeorm";
import { AgentsService } from "src/agents/agents.service";
import { createClaudeDev } from "./agent/claude-dev.agent";
import { McpRegistryService } from "src/mcp-registry/mcp-registry.service";
import { createTaskeroo, createTaskerooScopes } from "./mcp/taskeroo.mcp";
import { CreateServerInput, ServerRecord } from "src/mcp-registry/dto";
import { ScopeAlreadyExistsError, ServerAlreadyExistsError } from "src/mcp-registry/errors/mcp-registry.errors";
import { AgentResult, CreateAgentInput } from "src/agents/dto/service/agents.service.types";
import { AgentSlugConflictError } from "src/agents/errors/agents.errors";
import { createWikiroo, createWikirooScopes } from "./mcp/wikiroo.mcp";
import { getConfig } from "src/config/env.config";
import { devUser, devUserRole } from "./user/dev.user";
import { adminUser, adminUserRole } from "./user/admin.user";
import { CreateUserInput } from "src/identity-provider/dto/service/identity-provider.service.types";
import { UserRole, ActorType } from "src/identity-provider/enums";
import { User } from "src/identity-provider/user.entity";
import { ActorEntity } from "src/identity-provider/actor.entity";
import { AgentEntity } from "src/agents/agent.entity";
import { IdentityProviderService } from "src/identity-provider/identity-provider.service";
import { Scope } from "src/auth/core/types/scope.type";

@Injectable()
export class AppInitRunner implements OnApplicationBootstrap {

  private logger = new Logger(AppInitRunner.name);

  constructor(
    @Inject()
    private readonly agentsService: AgentsService,
    private readonly mcpRegistryService: McpRegistryService,
    private readonly identityProviderService: IdentityProviderService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    @InjectRepository(AgentEntity)
    private readonly agentRepository: Repository<AgentEntity>,
  ) { }

  async onApplicationBootstrap() {
    const config = getConfig();

    // Run actor migration first (before ensuring users/agents)
    await this.ensureActorMigration();

    await this.ensureAgents();
    await this.ensureMcpServers();
    
    if (config.nodeEnv === 'development') {
      this.logger.error('Users OK');
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
      this.logger.log(`Found ${usersWithoutActor.length} users without actors, migrating...`);
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
          this.logger.error(`Failed to migrate user ${user.email}: ${error}`);
        }
      }
    }

    // Migrate agents without actors
    const agentsWithoutActor = await this.agentRepository.find({
      where: { actorId: IsNull() },
    });

    if (agentsWithoutActor.length > 0) {
      this.logger.log(`Found ${agentsWithoutActor.length} agents without actors, migrating...`);
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
          this.logger.error(`Failed to migrate agent ${agent.slug}: ${error}`);
        }
      }
    }

    this.logger.log('Actor migration check completed.');
  }

  async ensureAgents() {
    // Create agents
    try {
      await this.ensureAgentExists(createClaudeDev);
    } catch (error) {
      this.logger.error('Error ensuring claude-dev Agent exists');
    }
  }

  async ensureMcpServers() {
    try {
      await this.ensureMcpServerExists(createTaskeroo, createTaskerooScopes);
    } catch (error) {
      this.logger.error('Error ensuring Taskeroo MCP Server exists');
    }
    try {
      await this.ensureMcpServerExists(createWikiroo, createWikirooScopes);
    } catch (error) {
      this.logger.error('Error ensuring Wikiroo MCP Server exists');
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

  async ensureAgentExists(agentConfig: CreateAgentInput): Promise<AgentResult | null> {
    let agent: AgentResult | null = null;
    try {
      agent = await this.agentsService.createAgent(agentConfig);
    } catch (error) {
      if (error instanceof AgentSlugConflictError) {
        agent = await this.agentsService.getAgentBySlug({ slug: agentConfig.slug });
        // TODO: rework the update method
        // agent = await this.agentsService.updateAgent(agent.id, createClaudeDev);
      } else {
        throw error;
      }
    }
    return agent;
  }

  async ensureMcpServerExists(serverConfig: CreateServerInput, scopesConfig: Scope[]): Promise<ServerRecord | null> {
    let server: ServerRecord | null = null;
    try {
      server = await this.mcpRegistryService.createServer(serverConfig);
    } catch (error) {
      if (error instanceof ServerAlreadyExistsError) {
        server = await this.mcpRegistryService.getServerByProvidedId(serverConfig.providedId);
        if (server.name != serverConfig.name ||
          server.description != serverConfig.description ||
          server.url != serverConfig.url
        ) {
          server = await this.mcpRegistryService.updateServer(server.id, {
            name: serverConfig.name,
            description: serverConfig.description,
            url: serverConfig.url,
          })
        }
      } else {
        throw error;
      }
    }
    try {
      this.logger.log(`Ensuring scopes for MCP Server ${server.name}`);
      await this.mcpRegistryService.createScopes(server.id, scopesConfig);
      this.logger.log(`Scopes ensured for MCP Server ${server.name}`);
    } catch (error) {
      if (!(error instanceof ScopeAlreadyExistsError)) {
        this.logger.error(`Error ensuring scopes for MCP Server ${server.name}: ${error}`);
        throw error;
      }
      this.logger.log(`Scopes already exist for MCP Server ${server.name}`);
    }
    return server;
  }

  async ensureUserExists(userConfig: CreateUserInput, userRole: UserRole): Promise<User | null> {
    let user: User | null = null;
    try {
      user = await this.identityProviderService.createUser(userConfig);
    } catch (error) {
      console
      throw error;
    }
    return user;
  }
}