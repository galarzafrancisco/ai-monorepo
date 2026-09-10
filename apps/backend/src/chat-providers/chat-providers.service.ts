import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ChatProviderEntity } from './chat-provider.entity';
import { SecretsService } from '../secrets/secrets.service';
import {
  CreateChatProviderInput,
  UpdateChatProviderInput,
  SetActiveChatProviderInput,
  ChatProviderResult,
  ActiveChatProviderConfigResult,
} from './dto/service/chat-providers.service.types';
import {
  ChatProviderNotFoundError,
  ChatProviderNotConfiguredError,
  NoActiveChatProviderError,
} from './errors/chat-providers.errors';
import { ChatProviderType } from './enums';

@Injectable()
export class ChatProvidersService {
  private readonly logger = new Logger(ChatProvidersService.name);

  constructor(
    @InjectRepository(ChatProviderEntity)
    private readonly chatProviderRepository: Repository<ChatProviderEntity>,
    private readonly secretsService: SecretsService,
    private readonly dataSource: DataSource,
  ) {}

  async createChatProvider(
    input: CreateChatProviderInput,
  ): Promise<ChatProviderResult> {
    this.logger.log({ message: 'Creating chat provider', name: input.name });

    const provider = this.chatProviderRepository.create({
      name: input.name,
      type: input.type,
      secretId: input.secretId ?? null,
      isActive: false,
    });

    const saved = await this.chatProviderRepository.save(provider);

    return this.mapToResult(saved);
  }

  async listChatProviders(): Promise<ChatProviderResult[]> {
    this.logger.log({ message: 'Listing chat providers' });

    const providers = await this.chatProviderRepository.find({
      order: { createdAt: 'ASC' },
    });

    return providers.map((p) => this.mapToResult(p));
  }

  async getChatProviderById(id: string): Promise<ChatProviderResult> {
    this.logger.log({ message: 'Fetching chat provider by id', id });

    const provider = await this.chatProviderRepository.findOne({
      where: { id },
    });

    if (!provider) {
      throw new ChatProviderNotFoundError(id);
    }

    return this.mapToResult(provider);
  }

  async updateChatProvider(
    id: string,
    input: UpdateChatProviderInput,
  ): Promise<ChatProviderResult> {
    this.logger.log({ message: 'Updating chat provider', id });

    const provider = await this.chatProviderRepository.findOne({
      where: { id },
    });

    if (!provider) {
      throw new ChatProviderNotFoundError(id);
    }

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

        await this.secretsService.updateSecret(provider.secretId, {
          value: input.apiKey,
          description: `API key for ${provider.name} chat provider`,
        });
      } else {
        this.logger.log({ message: 'Creating secret for API key', providerId: id });

        const secret = await this.secretsService.createSecret({
          name: `${provider.name} API Key`,
          description: `API key for ${provider.name} chat provider`,
          value: input.apiKey,
          createdByActorId: input.createdByActorId,
        });

        provider.secretId = secret.id;
      }
    } else if (input.secretId !== undefined) {
      // Fallback to direct secretId assignment if provided
      provider.secretId = input.secretId;
    }

    await this.chatProviderRepository.save(provider);

    return this.mapToResult(provider);
  }

  async deleteChatProvider(id: string): Promise<void> {
    this.logger.log({ message: 'Deleting chat provider', id });

    const provider = await this.chatProviderRepository.findOne({
      where: { id },
    });

    if (!provider) {
      throw new ChatProviderNotFoundError(id);
    }

    await this.chatProviderRepository.softDelete(id);
  }

  async setActiveChatProvider(
    input: SetActiveChatProviderInput,
  ): Promise<ChatProviderResult> {
    this.logger.log({
      message: 'Setting active chat provider',
      providerId: input.providerId,
    });

    // Use a transaction to prevent race conditions
    return await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ChatProviderEntity);

      const provider = await repository.findOne({
        where: { id: input.providerId },
      });

      if (!provider) {
        throw new ChatProviderNotFoundError(input.providerId);
      }

      // ADK uses environment variables and needs no stored API key
      if (provider.type !== ChatProviderType.ADK && !provider.secretId) {
        throw new ChatProviderNotConfiguredError(input.providerId);
      }

      // Deactivate all other providers without relying on empty update criteria.
      await repository
        .createQueryBuilder()
        .update(ChatProviderEntity)
        .set({ isActive: false })
        .where('id != :providerId', { providerId: input.providerId })
        .andWhere('is_active = :isActive', { isActive: true })
        .execute();

      // Activate the selected provider
      provider.isActive = true;
      const saved = await repository.save(provider);

      return this.mapToResult(saved);
    });
  }

  async deactivateActiveChatProvider(): Promise<void> {
    this.logger.log({ message: 'Deactivating active chat provider' });

    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(ChatProviderEntity);

      await repository
        .createQueryBuilder()
        .update(ChatProviderEntity)
        .set({ isActive: false })
        .where('is_active = :isActive', { isActive: true })
        .execute();
    });
  }

  async getActiveChatProviderConfig(): Promise<ActiveChatProviderConfigResult> {
    this.logger.log({ message: 'Fetching active chat provider configuration' });

    const activeProvider = await this.chatProviderRepository.findOne({
      where: { isActive: true },
    });

    if (!activeProvider) {
      throw new NoActiveChatProviderError();
    }

    // ADK uses environment variables and has no stored API key
    if (activeProvider.type === ChatProviderType.ADK) {
      return { type: activeProvider.type, apiKey: null };
    }

    if (!activeProvider.secretId) {
      throw new ChatProviderNotConfiguredError(activeProvider.id);
    }

    const secretValue = await this.secretsService.getSecretValue(
      activeProvider.secretId,
    );

    return {
      type: activeProvider.type,
      apiKey: secretValue.value,
    };
  }

  private mapToResult(provider: ChatProviderEntity): ChatProviderResult {
    return {
      id: provider.id,
      name: provider.name,
      type: provider.type,
      secretId: provider.secretId,
      isActive: provider.isActive,
      isConfigured: provider.type === ChatProviderType.ADK ? true : !!provider.secretId,
      rowVersion: provider.rowVersion,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }
}
