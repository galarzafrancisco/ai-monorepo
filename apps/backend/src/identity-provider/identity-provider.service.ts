import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from './user.entity';
import * as bcrypt from 'bcrypt';
import {
  CreateUserInput,
  CreateManagedUserInput,
  SetupManagedUserInput,
  UpdateUserRoleInput,
} from './dto/service/identity-provider.service.types';
import { ActorService, buildDeletedActorSlug } from './actor.service';
import { ActorEntity } from './actor.entity';
import { claimActorSlug, lockLiveActor } from './actor-slug';
import { ActorType, OnboardingDisplayMode, UserRole } from './enums';
import { addWorkspaceMembership } from '../workspaces/workspaces.service';
import { WorkspaceRole } from '../workspaces/enums';
import { DEFAULT_WORKSPACE_ID } from '../workspaces/workspaces.constants';
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

    const displayName = email.split('@')[0] || email;

    return this.userRepository.manager.transaction(async (manager) => {
      const slug = await this.claimAvailableSlug(manager, email);
      const actor = await this.actorService.createUserActor(manager, {
        slug,
        displayName,
      });
      const savedUser = await manager.save(
        User,
        manager.create(User, {
          email,
          passwordHash: this.createPendingPasswordHash(),
          actorId: actor.id,
          role: input.role,
          isActive: true,
        }),
      );
      await addWorkspaceMembership(manager, {
        ...(input.workspace ?? {
          workspaceId: DEFAULT_WORKSPACE_ID,
          role:
            input.role === UserRole.ADMIN
              ? WorkspaceRole.ADMIN
              : WorkspaceRole.MEMBER,
        }),
        actorId: actor.id,
      });
      savedUser.actor = actor;
      return savedUser;
    });
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

    const passwordHash = await this.hashPassword(input.password);

    // The user and actor are re-read and locked here, and only the changed
    // columns written, so a concurrent deactivation can't be undone and a
    // released slug can't come back (see `lockLiveActor`).
    const userId = await this.userRepository.manager.transaction(
      async (manager) => {
        const user = await manager.findOne(User, {
          where: { email: normalizedEmail, isActive: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (!user || !this.isPasswordSetupPending(user)) {
          throw new InvalidCredentialsError();
        }
        const actor = await lockLiveActor(manager, user.actorId);
        if (!actor) {
          this.logger.error('User returned no actor during account setup. This should not happen!');
          throw new InternalServerErrorException('Failed to retrieve actor');
        }

        if (actor.slug !== input.slug) {
          await this.actorService.claimPersonSlug(manager, input.slug, actor.id);
        }
        await manager.update(
          ActorEntity,
          { id: actor.id },
          { displayName: input.displayName, slug: input.slug },
        );
        await manager.update(User, { id: user.id }, { passwordHash });
        return user.id;
      },
    );

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { actor: true },
    });
    if (!user) {
      throw new UserNotFoundError(userId);
    }
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
    // Mark the actor too, so it stops being assignable, shows as deleted on
    // the work it touched, and gives its slug back. Rows are re-read and
    // locked here so a concurrent setup can't restore them (`lockLiveActor`).
    await this.userRepository.manager.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId, isActive: true },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) {
        throw new UserNotFoundError(userId);
      }
      const actor = await lockLiveActor(manager, user.actorId);
      if (actor) {
        await manager.update(
          ActorEntity,
          { id: actor.id },
          { deletedAt: new Date(), slug: buildDeletedActorSlug(actor) },
        );
      }
      await manager.update(User, { id: user.id }, { isActive: false });
    });

    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { actor: true },
    });
    if (!user) {
      throw new UserNotFoundError(userId);
    }
    return user;
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

  /**
   * Sets the installation role. `admin` makes the person an installation
   * operator (`installation:admin`); it does not change any workspace role.
   */
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

    return this.userRepository.manager.transaction(async (manager) => {
      const actor = await this.actorService.createUserActor(manager, {
        slug,
        displayName,
        introduction,
      });
      const savedUser = await manager.save(
        User,
        manager.create(User, { email, passwordHash, actorId: actor.id }),
      );
      await addWorkspaceMembership(manager, {
        ...(createUserInput.workspace ?? {
          workspaceId: DEFAULT_WORKSPACE_ID,
          role: WorkspaceRole.MEMBER,
        }),
        actorId: actor.id,
      });
      savedUser.actor = actor;
      return savedUser;
    });
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

          const savedActor = await this.actorService.createUserActor(
            transactionalEntityManager,
            { slug, displayName, introduction },
          );

          // Create user with admin role
          const user = transactionalEntityManager.create(User, {
            email,
            passwordHash,
            actorId: savedActor.id,
            role: UserRole.ADMIN,
          });

          const savedUser = await transactionalEntityManager.save(User, user);
          // The first person runs the installation and its default workspace.
          await addWorkspaceMembership(transactionalEntityManager, {
            workspaceId: DEFAULT_WORKSPACE_ID,
            actorId: savedActor.id,
            role: WorkspaceRole.ADMIN,
          });
          savedUser.actor = savedActor;

          return savedUser;
        },
      );
    } catch (error: any) {
      // Handle database constraint violations
      if (
        error.code === '23505'
      ) {
        // Determine which constraint was violated
        if (error.constraint?.includes('actor') || error.detail?.includes('(slug)')) {
          throw new UserSlugConflictError(createUserInput.slug);
        } else if (error.constraint?.includes('email') || error.detail?.includes('(email)')) {
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

  /**
   * The first free slug derived from the email, claimed inside `manager`'s
   * transaction (see `claimActorSlug`).
   */
  private async claimAvailableSlug(
    manager: EntityManager,
    email: string,
  ): Promise<string> {
    const baseSlug =
      email
        .split('@')[0]
        ?.toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'user';

    let slug = baseSlug;
    let suffix = 2;
    while (
      !(await claimActorSlug(manager, { type: ActorType.HUMAN, slug }))
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
      if (suffix > 1000) {
        throw new InternalServerErrorException('Could not generate a unique username');
      }
    }

    return slug;
  }
}
