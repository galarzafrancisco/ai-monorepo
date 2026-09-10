import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import {
  CreateUserInput,
  CreateManagedUserInput,
  SetupManagedUserInput,
  UpdateUserRoleInput,
} from './dto/service/identity-provider.service.types';
import { ActorService } from './actor.service';
import { ActorEntity } from './actor.entity';
import { ActorType, OnboardingDisplayMode, UserRole } from './enums';
import {
  InvalidCredentialsError,
  InvalidCurrentPasswordError,
  PasswordTooShortError,
  UserEmailConflictError,
  UserNotFoundError,
  UserSlugConflictError,
} from './errors/identity-provider.errors';

@Injectable()
export class IdentityProviderService {
  private logger = new Logger(IdentityProviderService.name);
  private readonly pendingPasswordPrefix = 'pending-password:';

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
      throw new InvalidCredentialsError();
    }

    if (this.isPasswordSetupPending(user)) {
      throw new InvalidCredentialsError();
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new InvalidCredentialsError();
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

  isPasswordSetupPending(user: User): boolean {
    return user.passwordHash.startsWith(this.pendingPasswordPrefix);
  }

  async listManagedUsers(): Promise<User[]> {
    return this.userRepository.find({
      relations: { actor: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createManagedUser(input: CreateManagedUserInput): Promise<User> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new UserEmailConflictError(email);
    }

    const slug = await this.createAvailableSlug(email);
    const displayName = email.split('@')[0] || email;

    const actor = await this.actorService.createUserActor({
      slug,
      displayName,
    });

    const user = this.userRepository.create({
      email,
      passwordHash: this.createPendingPasswordHash(),
      actorId: actor.id,
      role: input.role,
      isActive: true,
    });
    const savedUser = await this.userRepository.save(user);
    savedUser.actor = actor;
    return savedUser;
  }

  async getManagedAccountSetupStatus(email: string): Promise<{ email: string; canSetup: boolean }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail, isActive: true },
    });

    return {
      email: normalizedEmail,
      canSetup: Boolean(user && this.isPasswordSetupPending(user)),
    };
  }

  async setupManagedUser(input: SetupManagedUserInput): Promise<User> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const MIN_PASSWORD_LENGTH = 8;
    if (input.password.length < MIN_PASSWORD_LENGTH) {
      throw new PasswordTooShortError(MIN_PASSWORD_LENGTH);
    }

    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail, isActive: true },
      relations: { actor: true },
    });
    if (!user || !this.isPasswordSetupPending(user)) {
      throw new InvalidCredentialsError();
    }
    if (!user.actor) {
      this.logger.error('User returned no actor during account setup. This should not happen!');
      throw new InternalServerErrorException('Failed to retrieve actor');
    }

    const slugTaken = await this.actorService.isSlugTaken(input.slug);
    if (slugTaken && user.actor.slug !== input.slug) {
      throw new UserSlugConflictError(input.slug);
    }

    user.actor.displayName = input.displayName;
    user.actor.slug = input.slug;
    user.passwordHash = await this.hashPassword(input.password);

    await this.userRepository.manager.transaction(async (manager) => {
      await manager.save(ActorEntity, user.actor!);
      await manager.save(User, user);
    });

    return user;
  }

  async resetManagedUserPassword(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: { actor: true },
    });
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.passwordHash = this.createPendingPasswordHash();
    return this.userRepository.save(user);
  }

  async deactivateManagedUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
      relations: { actor: true },
    });
    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.isActive = false;
    return this.userRepository.save(user);
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

  async getUserByActorId(actorId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { actorId, isActive: true },
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
      throw new UserNotFoundError(userId);
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new InvalidCurrentPasswordError();
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
   * @throws {PasswordTooShortError} If the password is shorter than 8 characters
   * @throws {UserEmailConflictError} If a user with the email already exists
   * @throws {UserSlugConflictError} If an actor with the slug already exists
   * @throws {OnboardingNotAllowedError} If admin users already exist
   */
  async createFirstAdminUserIfNeeded(
    createUserInput: CreateUserInput,
  ): Promise<User | null> {
    // Validate password length before transaction
    const MIN_PASSWORD_LENGTH = 8;
    if (createUserInput.password.length < MIN_PASSWORD_LENGTH) {
      throw new PasswordTooShortError(MIN_PASSWORD_LENGTH);
    }

    // Use a transaction to ensure atomicity of check + create
    try {
      return await this.userRepository.manager.transaction(
        async transactionalEntityManager => {
          // Check if admin users exist within the transaction
          const adminCount = await transactionalEntityManager.count(User, {
            where: { role: UserRole.ADMIN, isActive: true },
          });

          if (adminCount > 0) {
            // Admin users already exist
            return null;
          }

          // Create the admin user within the transaction
          const { password, email, displayName, slug, introduction } =
            createUserInput;
          const passwordHash = await this.hashPassword(password);

          // Create actor within the transaction (not via service to maintain atomicity)
          const actor = transactionalEntityManager.create(ActorEntity, {
            type: ActorType.HUMAN,
            slug,
            displayName,
            avatarUrl: null,
            introduction: introduction ?? null,
          });
          const savedActor = await transactionalEntityManager.save(
            ActorEntity,
            actor,
          );

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
        },
      );
    } catch (error: any) {
      // Handle database constraint violations
      if (
        error.code === 'SQLITE_CONSTRAINT' ||
        error.message?.includes('UNIQUE constraint failed')
      ) {
        // Determine which constraint was violated
        if (error.message?.includes('actors.slug')) {
          throw new UserSlugConflictError(createUserInput.slug);
        } else if (error.message?.includes('users.email')) {
          throw new UserEmailConflictError(createUserInput.email);
        }
      }
      // Re-throw if it's not a constraint violation we handle
      throw error;
    }
  }

  async markWalkthroughSeen(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new UserNotFoundError(userId);
    }

    user.onboardingDisplayMode = OnboardingDisplayMode.OFF;
    await this.userRepository.save(user);

    this.logger.log(`Walkthrough marked as seen for user: ${user.email}`);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private createPendingPasswordHash(): string {
    return `${this.pendingPasswordPrefix}${randomBytes(24).toString('hex')}`;
  }

  private async createAvailableSlug(email: string): Promise<string> {
    const baseSlug =
      email
        .split('@')[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'user';

    let slug = baseSlug;
    let suffix = 2;
    while (await this.actorService.isSlugTaken(slug)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
      if (suffix > 1000) {
        throw new InternalServerErrorException('Could not generate a unique username');
      }
    }

    return slug;
  }
}
