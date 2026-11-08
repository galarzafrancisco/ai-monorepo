import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { isChatgptSubscriptionEnabled } from '../config/env.config';
import { AiProviderEntity } from './ai-provider.entity';
import { AiModelSelectionEntity } from './ai-model-selection.entity';
import { SecretsService } from '../secrets/secrets.service';
import {
  CreateAiProviderInput,
  UpdateAiProviderInput,
  AiProviderResult,
  AiProviderConfigResult,
} from './dto/service/ai-providers.service.types';
import {
  AiProviderNotFoundError,
  AiProviderNotConfiguredError,
  AiProviderInUseError,
  AiProviderAlreadyExistsError,
} from './errors/ai-providers.errors';
import { ChatgptConnectionsService } from './chatgpt-subscription/chatgpt-connections.service';
import { AiProviderType } from './enums';
import {
  googleApiKeyFromEnv,
  mayUseServerCredentials,
  vertexLocationFromEnv,
  vertexProjectFromEnv,
} from './google-environment';

/** Trims text input. Undefined means "leave unchanged"; blank means "clear". */
function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value?.trim() || null;
}

/**
 * The Google settings a provider gets from the server environment when it
 * stores none. Empty for providers outside the default workspace.
 */
function environmentFallback(provider: AiProviderEntity): {
  apiKey: string | null;
  project: string | null;
  location: string | null;
} {
  if (!mayUseServerCredentials(provider.workspaceId)) {
    return { apiKey: null, project: null, location: null };
  }
  switch (provider.type) {
    case AiProviderType.GOOGLE:
      return { apiKey: googleApiKeyFromEnv() ?? null, project: null, location: null };
    case AiProviderType.GOOGLE_VERTEX:
      return {
        apiKey: null,
        project: vertexProjectFromEnv() ?? null,
        location: vertexLocationFromEnv() ?? null,
      };
    default:
      return { apiKey: null, project: null, location: null };
  }
}

/**
 * Whether a provider has the settings it needs to make a call. Vertex AI needs
 * a project and a location. In the default workspace they may come from the
 * environment and its credentials from application default credentials, which
 * cannot be checked here; any other workspace must store all three.
 */
export function isAiProviderConfigured(provider: AiProviderEntity): boolean {
  const fallback = environmentFallback(provider);
  switch (provider.type) {
    case AiProviderType.GOOGLE_VERTEX:
      return (
        !!(provider.project ?? fallback.project) &&
        !!(provider.location ?? fallback.location) &&
        (!!provider.secretId || mayUseServerCredentials(provider.workspaceId))
      );
    case AiProviderType.GOOGLE:
      return !!provider.secretId || !!fallback.apiKey;
    case AiProviderType.OPENAI_COMPATIBLE:
      return !!provider.baseUrl;
    case AiProviderType.CHATGPT_SUBSCRIPTION:
      // No shared credentials: each person connects their own account.
      return isChatgptSubscriptionEnabled();
    default:
      return !!provider.secretId;
  }
}

/**
 * A workspace's AI providers. Every method takes the workspace first; a
 * provider in another workspace is not found. Settings → AI models is where a
 * workspace admin manages them, and every member's threads use them.
 */
@Injectable()
export class AiProvidersService {
  private readonly logger = new Logger(AiProvidersService.name);

  constructor(
    @InjectRepository(AiProviderEntity)
    private readonly aiProviderRepository: Repository<AiProviderEntity>,
    private readonly secretsService: SecretsService,
    private readonly dataSource: DataSource,
    private readonly chatgptConnections: ChatgptConnectionsService,
  ) {}

  async createAiProvider(
    workspaceId: string,
    input: CreateAiProviderInput,
  ): Promise<AiProviderResult> {
    this.logger.log({ message: 'Creating AI provider', workspaceId, name: input.name });

    const isChatgpt = input.type === AiProviderType.CHATGPT_SUBSCRIPTION;
    if (isChatgpt) {
      this.chatgptConnections.assertAvailable();
      // One per workspace is enough: it holds no account of its own. A unique index backs this check.
      if (await this.aiProviderRepository.exists({ where: { workspaceId, type: input.type } })) {
        throw new AiProviderAlreadyExistsError(input.type);
      }
    }
    // A provider only uses a secret of its own workspace.
    if (input.secretId) {
      await this.secretsService.getSecretById(workspaceId, input.secretId);
    }

    const provider = this.aiProviderRepository.create({
      workspaceId,
      name: input.name,
      type: input.type,
      secretId: input.secretId ?? null,
      baseUrl: normalizeOptionalText(input.baseUrl) ?? null,
      project: normalizeOptionalText(input.project) ?? null,
      location: normalizeOptionalText(input.location) ?? null,
      hostId: isChatgpt ? `urn:uuid:${randomUUID()}` : null,
    });

    const saved = await this.aiProviderRepository.save(provider);

    return this.mapToResult(saved);
  }

  async listAiProviders(workspaceId: string): Promise<AiProviderResult[]> {
    this.logger.log({ message: 'Listing AI providers', workspaceId });

    const providers = await this.aiProviderRepository.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });

    return providers.map((p) => this.mapToResult(p));
  }

  async getAiProviderById(workspaceId: string, id: string): Promise<AiProviderResult> {
    this.logger.log({ message: 'Fetching AI provider by id', workspaceId, id });

    return this.mapToResult(await this.findProvider(workspaceId, id));
  }

  async updateAiProvider(
    workspaceId: string,
    id: string,
    input: UpdateAiProviderInput,
  ): Promise<AiProviderResult> {
    this.logger.log({ message: 'Updating AI provider', workspaceId, id });

    const provider = await this.findProvider(workspaceId, id);

    if (input.name !== undefined) {
      provider.name = input.name;
    }

    // If apiKey is provided, create a secret automatically
    if (input.apiKey !== undefined) {
      if (!input.createdByActorId) {
        throw new Error('createdByActorId is required when providing an API key');
      }

      if (provider.secretId) {
        this.logger.log({ message: 'Updating secret for API key', providerId: id });

        await this.secretsService.updateSecret(workspaceId, provider.secretId, {
          value: input.apiKey,
          description: `API key for ${provider.name} AI provider`,
        });
      } else {
        this.logger.log({ message: 'Creating secret for API key', providerId: id });

        const secret = await this.secretsService.createSecret(workspaceId, {
          name: `${provider.name} API Key`,
          description: `API key for ${provider.name} AI provider`,
          value: input.apiKey,
          createdByActorId: input.createdByActorId,
        });

        provider.secretId = secret.id;
      }
    } else if (input.secretId !== undefined) {
      // Fallback to direct secretId assignment if provided. Only a secret of this workspace.
      if (input.secretId) {
        await this.secretsService.getSecretById(workspaceId, input.secretId);
      }
      provider.secretId = input.secretId;
    }

    for (const field of ['baseUrl', 'project', 'location'] as const) {
      const value = normalizeOptionalText(input[field]);
      if (value !== undefined) {
        provider[field] = value;
      }
    }

    const saved = await this.aiProviderRepository.save(provider);

    return this.mapToResult(saved);
  }

  async deleteAiProvider(workspaceId: string, id: string): Promise<void> {
    this.logger.log({ message: 'Deleting AI provider', workspaceId, id });

    const type = await this.dataSource.transaction(async (manager) => {
      // Locked so a job cannot select this provider while it is being deleted.
      const provider = await manager.getRepository(AiProviderEntity).findOne({
        where: { workspaceId, id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!provider) {
        throw new AiProviderNotFoundError(id);
      }

      const selections = await manager
        .getRepository(AiModelSelectionEntity)
        .find({ where: { workspaceId, aiProviderId: id } });
      if (selections.length > 0) {
        throw new AiProviderInUseError(id, selections.map((selection) => selection.job));
      }

      await manager.getRepository(AiProviderEntity).softDelete({ workspaceId, id });
      // Threads pinned to this provider go back to following the conversation model.
      await manager.query(
        `UPDATE threads SET ai_provider_id = NULL, model_id = NULL
          WHERE ai_provider_id = $1 AND workspace_id = $2`,
        [id, workspaceId],
      );
      return provider.type;
    });

    if (type === AiProviderType.CHATGPT_SUBSCRIPTION) {
      // Nobody can use the provider any more, so nobody's grant should outlive it.
      await this.chatgptConnections.disconnectAll(workspaceId, id);
    }
  }

  /** The settings a call to the provider needs, its API key included. Never sent to clients. */
  async getAiProviderConfigById(
    workspaceId: string,
    id: string,
  ): Promise<AiProviderConfigResult> {
    return this.toProviderConfig(await this.findProvider(workspaceId, id));
  }

  private async findProvider(workspaceId: string, id: string): Promise<AiProviderEntity> {
    const provider = await this.aiProviderRepository.findOne({
      where: { workspaceId, id },
    });
    if (!provider) {
      throw new AiProviderNotFoundError(id);
    }
    return provider;
  }

  private async toProviderConfig(
    provider: AiProviderEntity,
  ): Promise<AiProviderConfigResult> {
    if (!isAiProviderConfigured(provider)) {
      throw new AiProviderNotConfiguredError(provider.id);
    }

    const secretValue = provider.secretId
      ? await this.secretsService.getSecretValue(provider.workspaceId, provider.secretId)
      : null;
    const fallback = environmentFallback(provider);

    return {
      id: provider.id,
      type: provider.type,
      apiKey: secretValue?.value ?? fallback.apiKey,
      baseUrl: provider.baseUrl,
      project: provider.project ?? fallback.project,
      location: provider.location ?? fallback.location,
      serverCredentials: mayUseServerCredentials(provider.workspaceId),
    };
  }

  private mapToResult(provider: AiProviderEntity): AiProviderResult {
    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      secretId: provider.secretId,
      baseUrl: provider.baseUrl,
      project: provider.project,
      location: provider.location,
      isConfigured: isAiProviderConfigured(provider),
      rowVersion: provider.rowVersion,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
