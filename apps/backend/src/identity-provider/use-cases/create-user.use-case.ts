import { Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { ActorEntity } from '../actor.entity';
import { ActorType, UserRole } from '../enums';
import {
  UserEmailConflictError,
  UserSlugConflictError,
} from '../errors/identity-provider.errors';
import { User } from '../user.entity';

export type CreateUserCommand = {
  email: string;
  passwordHash: string;
  displayName: string;
  slug: string;
  introduction?: string;
  role?: UserRole;
};

/** Creates the user and its required human actor as one aggregate. */
@Injectable()
export class CreateUserUseCase {
  constructor(private readonly dataSource: DataSource) {}

  async execute(command: CreateUserCommand): Promise<User> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const actorRepository = manager.getRepository(ActorEntity);
        const userRepository = manager.getRepository(User);
        const actor = await actorRepository.save(
          actorRepository.create({
            type: ActorType.HUMAN,
            slug: command.slug,
            displayName: command.displayName,
            avatarUrl: null,
            introduction: command.introduction ?? null,
          }),
        );
        const user = await userRepository.save(
          userRepository.create({
            email: command.email,
            passwordHash: command.passwordHash,
            actorId: actor.id,
            role: command.role ?? UserRole.STANDARD,
            isActive: true,
          }),
        );
        user.actor = actor;
        return user;
      });
    } catch (error) {
      if (!(error instanceof QueryFailedError)) throw error;
      const message = String(
        (error.driverError as { message?: string }).message ?? '',
      );
      if (message.includes('users.email')) {
        throw new UserEmailConflictError(command.email);
      }
      if (message.includes('actors.slug')) {
        throw new UserSlugConflictError(command.slug);
      }
      throw error;
    }
  }
}
