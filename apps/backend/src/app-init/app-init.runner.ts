import { Inject, Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { AgentsService } from "src/agents/agents.service";
import { createClaudeDev } from "./agent/claude-dev.agent";
import { McpRegistryService } from "src/mcp-registry/mcp-registry.service";
import { createTaskeroo, createTaskerooScopes } from "./mcp/taskeroo.mcp";
import { CreateScopeInput, CreateServerInput, ServerRecord } from "src/mcp-registry/dto";
import { ScopeAlreadyExistsError, ServerAlreadyExistsError } from "src/mcp-registry/errors/mcp-registry.errors";
import { AgentResult, CreateAgentInput } from "src/agents/dto/service/agents.service.types";
import { AgentSlugConflictError } from "src/agents/errors/agents.errors";
import { createWikiroo, createWikirooScopes } from "./mcp/wikiroo.mcp";
import { getConfig } from "src/config/env.config";
import { devUser, devUserRole } from "./user/dev.user";
import { adminUser, adminUserRole } from "./user/admin.user";
import { CreateUserInput } from "src/identity-provider/dto/service/identity-provider.service.types";
import { UserRole } from "src/identity-provider/enums";
import { User } from "src/identity-provider/user.entity";
import { IdentityProviderService } from "src/identity-provider/identity-provider.service";

@Injectable()
export class AppInitRunner implements OnApplicationBootstrap {

  private logger = new Logger(AppInitRunner.name);

  constructor(
    @Inject()
    private readonly agentsService: AgentsService,
    private readonly mcpRegistryService: McpRegistryService,
    private readonly identityProviderService: IdentityProviderService,
  ) { }

  async onApplicationBootstrap() {
    const config = getConfig();

    this.ensureAgents();
    this.ensureMcpServers();

    if (config.nodeEnv === 'development') {
      this.ensureUsers();
    }
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
        agent = await this.agentsService.getAgentBySlug(agentConfig.slug);
        agent = await this.agentsService.updateAgent(agent.id, createClaudeDev);
      } else {
        throw error;
      }
    }
    return agent;
  }

  async ensureMcpServerExists(serverConfig: CreateServerInput, scopesConfig: CreateScopeInput[]): Promise<ServerRecord | null> {
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
      await this.mcpRegistryService.createScopes(server.id, scopesConfig);
    } catch (error) {
      if (!(error instanceof ScopeAlreadyExistsError)) {
        throw error;
      }
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