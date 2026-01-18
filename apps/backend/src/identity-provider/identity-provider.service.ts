import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { ActorEntity } from './actor.entity';
import { ActorType } from './enums';
import * as bcrypt from 'bcrypt';
import { CreateUserInput, UpdateUserRoleInput } from './dto/service/identity-provider.service.types';

@Injectable()
export class IdentityProviderService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
      relations: ['actor'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
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

  async updateUserRole(userId: string, updateUserRoleInput: UpdateUserRoleInput): Promise<User> {
    const { role } = updateUserRoleInput;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }
    user.role = role;
    return this.userRepository.save(user);
  }

  async createUser(createUserInput: CreateUserInput): Promise<User> {
    const { password, email, displayName } = createUserInput;
    const passwordHash = await this.hashPassword(password);

    // Create actor first (use email as slug for users)
    const actor = this.actorRepository.create({
      type: ActorType.USER,
      slug: email,
      displayName,
      avatarUrl: null,
    });
    const savedActor = await this.actorRepository.save(actor);

    // Create user with actor reference
    const user = this.userRepository.create({
      email,
      passwordHash,
      actorId: savedActor.id,
    });
    const savedUser = await this.userRepository.save(user);

    // Load actor relation for the returned user
    savedUser.actor = savedActor;
    return savedUser;
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }
}
