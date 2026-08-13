import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SecretEntity } from '../../secrets/secret.entity';
import { SecretsEncryptionService } from '../../secrets/secrets-encryption.service';
import { ChatProviderEntity } from '../chat-provider.entity';
import { UpdateChatProviderInput } from '../dto/service/chat-providers.service.types';
import { ChatProviderNotFoundError } from '../errors/chat-providers.errors';

@Injectable()
export class UpdateChatProviderUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly encryptionService: SecretsEncryptionService,
  ) {}

  async execute(
    id: string,
    input: UpdateChatProviderInput,
  ): Promise<ChatProviderEntity> {
    return this.dataSource.transaction(async (manager) => {
      const providerRepository = manager.getRepository(ChatProviderEntity);
      const secretRepository = manager.getRepository(SecretEntity);
      const provider = await providerRepository.findOne({ where: { id } });
      if (!provider) throw new ChatProviderNotFoundError(id);
      if (input.name !== undefined) provider.name = input.name;
      if (input.apiKey !== undefined) {
        if (!input.createdByActorId) {
          throw new Error(
            'createdByActorId is required when providing an API key',
          );
        }
        if (provider.secretId) {
          const secret = await secretRepository.findOne({
            where: { id: provider.secretId },
          });
          if (!secret)
            throw new Error(`Secret ${provider.secretId} is missing`);
          secret.encryptedValue = this.encryptionService.encrypt(input.apiKey);
          secret.description = `API key for ${provider.name} chat provider`;
          await secretRepository.save(secret);
        } else {
          const secret = await secretRepository.save(
            secretRepository.create({
              name: `${provider.name} API Key`,
              description: `API key for ${provider.name} chat provider`,
              encryptedValue: this.encryptionService.encrypt(input.apiKey),
              createdByActorId: input.createdByActorId,
            }),
          );
          provider.secretId = secret.id;
        }
      } else if (input.secretId !== undefined) {
        provider.secretId = input.secretId;
      }
      return providerRepository.save(provider);
    });
  }
}
