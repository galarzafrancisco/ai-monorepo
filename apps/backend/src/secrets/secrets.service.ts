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

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);

  constructor(
    @InjectRepository(SecretEntity)
    private readonly secretRepository: Repository<SecretEntity>,
    private readonly encryptionService: SecretsEncryptionService,
  ) {}

  async createSecret(input: CreateSecretInput): Promise<SecretResult> {
    this.logger.log({ message: 'Creating secret', name: input.name });

    const existing = await this.secretRepository.findOne({
      where: { name: input.name },
    });
    if (existing) {
      throw new SecretNameConflictError(input.name);
    }

    const encryptedValue = this.encryptionService.encrypt(input.value);

    const secret = this.secretRepository.create({
      name: input.name,
      description: input.description ?? null,
      encryptedValue,
      createdByActorId: input.createdByActorId,
    });

    const saved = await this.secretRepository.save(secret);

    const withRelations = await this.secretRepository.findOne({
      where: { id: saved.id },
      relations: ['createdByActor'],
    });

    return this.mapToResult(withRelations!);
  }

  async listSecrets(): Promise<SecretResult[]> {
    this.logger.log({ message: 'Listing secrets' });

    const secrets = await this.secretRepository.find({
      relations: ['createdByActor'],
      order: { createdAt: 'ASC' },
    });

    return secrets.map((s) => this.mapToResult(s));
  }

  async getSecretById(id: string): Promise<SecretResult> {
    this.logger.log({ message: 'Fetching secret by id', id });

    const secret = await this.secretRepository.findOne({
      where: { id },
      relations: ['createdByActor'],
    });

    if (!secret) {
      throw new SecretNotFoundError(id);
    }

    return this.mapToResult(secret);
  }

  async getSecretValue(id: string): Promise<SecretValueResult> {
    this.logger.log({ message: 'Fetching secret value', id });

    const secret = await this.secretRepository.findOne({
      where: { id },
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

  async updateSecret(id: string, input: UpdateSecretInput): Promise<SecretResult> {
    this.logger.log({ message: 'Updating secret', id });

    const secret = await this.secretRepository.findOne({
      where: { id },
    });

    if (!secret) {
      throw new SecretNotFoundError(id);
    }

    if (input.name !== undefined && input.name !== secret.name) {
      const existing = await this.secretRepository.findOne({
        where: { name: input.name },
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
      where: { id },
      relations: ['createdByActor'],
    });

    return this.mapToResult(updated!);
  }

  async deleteSecret(id: string): Promise<void> {
    this.logger.log({ message: 'Deleting secret', id });

    const secret = await this.secretRepository.findOne({
      where: { id },
    });

    if (!secret) {
      throw new SecretNotFoundError(id);
    }

    await this.secretRepository.softDelete(id);
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
