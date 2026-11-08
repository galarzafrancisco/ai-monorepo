import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SecretEntity } from './secret.entity';
import { SecretsEncryptionService } from './secrets-encryption.service';
import {
  CreateSecretInput,
  SecretResult,
  SecretValueResult,
  UpdateSecretInput,
} from './dto/service/secrets.service.types';
import {
  SecretNameConflictError,
  SecretNotFoundError,
} from './errors/secrets.errors';

/**
 * Encrypted values a workspace stores (API keys, tokens). Every method takes
 * the workspace first; a secret in another workspace is not found.
 */
@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);

  constructor(
    @InjectRepository(SecretEntity)
    private readonly secretRepository: Repository<SecretEntity>,
    private readonly encryptionService: SecretsEncryptionService,
  ) {}

  async createSecret(workspaceId: string, input: CreateSecretInput): Promise<SecretResult> {
    this.logger.log({ message: 'Creating secret', workspaceId, name: input.name });

    const existing = await this.secretRepository.findOne({
      where: { workspaceId, name: input.name },
    });
    if (existing) {
      throw new SecretNameConflictError(input.name);
    }

    const encryptedValue = this.encryptionService.encrypt(input.value);

    const secret = this.secretRepository.create({
      workspaceId,
      name: input.name,
      description: input.description ?? null,
      encryptedValue,
      createdByActorId: input.createdByActorId,
    });

    const saved = await this.secretRepository.save(secret);

    const withRelations = await this.secretRepository.findOne({
      where: { workspaceId, id: saved.id },
      relations: ['createdByActor'],
    });

    return this.mapToResult(withRelations!);
  }

  async listSecrets(workspaceId: string): Promise<SecretResult[]> {
    this.logger.log({ message: 'Listing secrets', workspaceId });

    const secrets = await this.secretRepository.find({
      where: { workspaceId },
      relations: ['createdByActor'],
      order: { createdAt: 'ASC' },
    });

    return secrets.map((s) => this.mapToResult(s));
  }

  async getSecretById(workspaceId: string, id: string): Promise<SecretResult> {
    this.logger.log({ message: 'Fetching secret by id', workspaceId, id });

    const secret = await this.secretRepository.findOne({
      where: { workspaceId, id },
      relations: ['createdByActor'],
    });

    if (!secret) {
      throw new SecretNotFoundError(id);
    }

    return this.mapToResult(secret);
  }

  async getSecretValue(workspaceId: string, id: string): Promise<SecretValueResult> {
    this.logger.log({ message: 'Fetching secret value', workspaceId, id });

    const secret = await this.secretRepository.findOne({
      where: { workspaceId, id },
    });

    if (!secret) {
      throw new SecretNotFoundError(id);
    }

    const value = this.encryptionService.decrypt(secret.encryptedValue);

    return {
      id: secret.id,
      name: secret.name,
      value,
    };
  }

  async updateSecret(
    workspaceId: string,
    id: string,
    input: UpdateSecretInput,
  ): Promise<SecretResult> {
    this.logger.log({ message: 'Updating secret', workspaceId, id });

    const secret = await this.secretRepository.findOne({
      where: { workspaceId, id },
    });

    if (!secret) {
      throw new SecretNotFoundError(id);
    }

    if (input.name !== undefined && input.name !== secret.name) {
      const existing = await this.secretRepository.findOne({
        where: { workspaceId, name: input.name },
      });
      if (existing) {
        throw new SecretNameConflictError(input.name);
      }
      secret.name = input.name;
    }

    if (input.description !== undefined) {
      secret.description = input.description;
    }

    if (input.value !== undefined) {
      secret.encryptedValue = this.encryptionService.encrypt(input.value);
    }

    await this.secretRepository.save(secret);

    const updated = await this.secretRepository.findOne({
      where: { workspaceId, id },
      relations: ['createdByActor'],
    });

    return this.mapToResult(updated!);
  }

  async deleteSecret(workspaceId: string, id: string): Promise<void> {
    this.logger.log({ message: 'Deleting secret', workspaceId, id });

    const secret = await this.secretRepository.findOne({
      where: { workspaceId, id },
    });

    if (!secret) {
      throw new SecretNotFoundError(id);
    }

    await this.secretRepository.softDelete({ workspaceId, id });
  }

  private mapToResult(secret: SecretEntity): SecretResult {
    return {
      id: secret.id,
      name: secret.name,
      description: secret.description,
      createdByActorId: secret.createdByActorId,
      createdBy: secret.createdBy,
      rowVersion: secret.rowVersion,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
    };
  }
}
