jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { SecretEntity } from '../../secrets/secret.entity';
import { SecretsEncryptionService } from '../../secrets/secrets-encryption.service';
import { ChatProviderEntity } from '../chat-provider.entity';
import { UpdateChatProviderUseCase } from './update-chat-provider.use-case';

describe('UpdateChatProviderUseCase', () => {
  it('creates and links an API-key secret using one transaction manager', async () => {
    const provider = Object.assign(new ChatProviderEntity(), {
      id: 'provider-1',
      name: 'OpenAI',
      secretId: null,
    });
    const secret = Object.assign(new SecretEntity(), { id: 'secret-1' });
    const providerRepository = Object.create(
      Repository.prototype,
    ) as Repository<ChatProviderEntity>;
    jest.spyOn(providerRepository, 'findOne').mockResolvedValue(provider);
    const saveProvider = jest
      .spyOn(providerRepository, 'save')
      .mockResolvedValue(provider);
    const secretRepository = Object.create(
      Repository.prototype,
    ) as Repository<SecretEntity>;
    jest
      .spyOn(secretRepository, 'create')
      .mockImplementation((input) => Object.assign(new SecretEntity(), input));
    jest.spyOn(secretRepository, 'save').mockResolvedValue(secret);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: typeof ChatProviderEntity | typeof SecretEntity) =>
        entity === ChatProviderEntity ? providerRepository : secretRepository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    Object.defineProperty(dataSource, 'transaction', {
      value: jest.fn(
        async (
          callback: (transactionManager: EntityManager) => Promise<unknown>,
        ) => callback(manager),
      ),
    });
    const encryptionService = Object.create(
      SecretsEncryptionService.prototype,
    ) as SecretsEncryptionService;
    jest.spyOn(encryptionService, 'encrypt').mockReturnValue('encrypted');
    const useCase = new UpdateChatProviderUseCase(
      dataSource,
      encryptionService,
    );

    await useCase.execute(provider.id, {
      apiKey: 'secret-value',
      createdByActorId: 'actor-1',
    });

    expect(saveProvider).toHaveBeenCalledWith(
      expect.objectContaining({ secretId: secret.id }),
    );
  });
});
