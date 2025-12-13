import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import * as crypto from 'crypto';

@Injectable()
export class IdentityProviderService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordHash = this.hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id, isActive: true },
    });
  }

  async createUser(
    email: string,
    displayName: string,
    password: string,
  ): Promise<User> {
    const passwordHash = this.hashPassword(password);
    const user = this.userRepository.create({
      email,
      displayName,
      passwordHash,
    });
    return this.userRepository.save(user);
  }

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
}
