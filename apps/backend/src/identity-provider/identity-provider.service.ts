import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import {
  CreateUserInput,
  UpdateUserRoleInput,
} from './dto/service/identity-provider.service.types';
import { ActorService } from './actor.service';
import { ActorEntity } from './actor.entity';
import { ActorType, UserRole } from './enums';

@Injectable()
export class IdentityProviderService {
  private logger = new Logger(IdentityProviderService.name);
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly actorService: ActorService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<{ user: User; actor: ActorEntity }> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
      relations: { actor: true },
    });

    if (!user) {
      // TODO: this is an HTTP exception. Should be service error.
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      // TODO: this is an HTTP exception. Should be service error.
      throw new UnauthorizedException('Invalid credentials');
    }

    // User must come with the actor expanded given how we queried it from the DB
    // But check just in case
    if (!user.actor) {
      this.logger.error('User returned no actor. This should not happen!');
      // TODO: this is an HTTP exception. Should be service error.
      throw new InternalServerErrorException('Failed to retrieve actor');
    }
    const actor = user.actor;

    return { user, actor };
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, isActive: true },
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email, isActive: true },
    });
  }

  async updateUserRole(
    userId: string,
    updateUserRoleInput: UpdateUserRoleInput,
  ): Promise<User> {
    const { role } = updateUserRoleInput;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    user.role = role;
    return this.userRepository.save(user);
  }

  async createUser(createUserInput: CreateUserInput): Promise<User> {
    const { password, email, displayName, slug, introduction } =
      createUserInput;
    const passwordHash = await this.hashPassword(password);

    // Create actor first (use email as slug for users)
    const actor = await this.actorService.createUserActor({
      slug,
      displayName,
      introduction,
    });

    // Create user with actor reference
    const user = this.userRepository.create({
      email,
      passwordHash,
      actorId: actor.id,
    });
    const savedUser = await this.userRepository.save(user);

    // Load actor relation for the returned user
    savedUser.actor = actor;
    return savedUser;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Find the user
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      // TODO: this is an HTTP exception. Should be service error.
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      // TODO: this is an HTTP exception. Should be service error.
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash and update new password
    user.passwordHash = await this.hashPassword(newPassword);
    await this.userRepository.save(user);

    this.logger.log(`Password changed successfully for user: ${user.email}`);
  }

  async hasAdminUsers(): Promise<boolean> {
    const count = await this.userRepository.count({
      where: { role: UserRole.ADMIN, isActive: true },
    });
    return count > 0;
  }

  /**
   * Atomically creates the first admin user if no admin users exist.
   * This method uses a database transaction to prevent race conditions
   * when multiple concurrent onboarding requests are made.
   *
   * @returns The created admin user, or null if admin users already exist
   */
  async createFirstAdminUserIfNeeded(createUserInput: CreateUserInput): Promise<User | null> {
    // Use a transaction to ensure atomicity of check + create
    return await this.userRepository.manager.transaction(async (transactionalEntityManager) => {
      // Check if admin users exist within the transaction
      const adminCount = await transactionalEntityManager.count(User, {
        where: { role: UserRole.ADMIN, isActive: true },
      });

      if (adminCount > 0) {
        // Admin users already exist
        return null;
      }

      // Create the admin user within the transaction
      const { password, email, displayName, slug, introduction } = createUserInput;
      const passwordHash = await this.hashPassword(password);

      // Create actor within the transaction (not via service to maintain atomicity)
      const actor = transactionalEntityManager.create(ActorEntity, {
        type: ActorType.HUMAN,
        slug,
        displayName,
        avatarUrl: null,
        introduction: introduction ?? null,
      });
      const savedActor = await transactionalEntityManager.save(ActorEntity, actor);

      // Create user with admin role
      const user = transactionalEntityManager.create(User, {
        email,
        passwordHash,
        actorId: savedActor.id,
        role: UserRole.ADMIN,
      });

      const savedUser = await transactionalEntityManager.save(User, user);
      savedUser.actor = savedActor;

      return savedUser;
    });
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
}
