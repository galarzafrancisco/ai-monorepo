jest.mock('@taico/errors', () => ({ ErrorCodes: {} }));

import { DataSource, EntityManager, Repository } from 'typeorm';
import { ActorEntity } from '../actor.entity';
import { User } from '../user.entity';
import { CreateUserUseCase } from './create-user.use-case';

describe('CreateUserUseCase', () => {
  it('creates the actor and user with the same transaction manager', async () => {
    const actor = Object.assign(new ActorEntity(), {
      id: 'actor-1',
      slug: 'person',
      displayName: 'Person',
    });
    const user = Object.assign(new User(), {
      id: 'user-1',
      email: 'person@example.test',
      actorId: actor.id,
    });
    const actorRepository = Object.create(
      Repository.prototype,
    ) as Repository<ActorEntity>;
    jest
      .spyOn(actorRepository, 'create')
      .mockImplementation((input) => Object.assign(new ActorEntity(), input));
    jest.spyOn(actorRepository, 'save').mockResolvedValue(actor);
    const userRepository = Object.create(
      Repository.prototype,
    ) as Repository<User>;
    jest
      .spyOn(userRepository, 'create')
      .mockImplementation((input) => Object.assign(new User(), input));
    jest.spyOn(userRepository, 'save').mockResolvedValue(user);
    const manager = Object.create(EntityManager.prototype) as EntityManager;
    Object.defineProperty(manager, 'getRepository', {
      value: (entity: unknown) =>
        entity === ActorEntity ? actorRepository : userRepository,
    });
    const dataSource = Object.create(DataSource.prototype) as DataSource;
    const transaction = jest.fn(
      async (
        callback: (transactionManager: EntityManager) => Promise<unknown>,
      ) => callback(manager),
    );
    Object.defineProperty(dataSource, 'transaction', { value: transaction });
    const useCase = new CreateUserUseCase(dataSource);

    const result = await useCase.execute({
      email: user.email,
      passwordHash: 'hashed',
      slug: actor.slug,
      displayName: actor.displayName,
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(actorRepository.save).toHaveBeenCalledWith(expect.any(ActorEntity));
    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: actor.id }),
    );
    expect(result.actor).toBe(actor);
  });
});
