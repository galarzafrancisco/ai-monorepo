import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { KeyStore, NewKey, StoredKey } from '@taico/auth';
import { MoreThan, Repository } from 'typeorm';
import { JwksKeyEntity } from './jwks-key.entity';

/** Taico's `jwks_keys` table behind the `@taico/auth` KeyStore port */
@Injectable()
export class JwksKeyStore implements KeyStore {
  constructor(
    @InjectRepository(JwksKeyEntity)
    private readonly keyRepository: Repository<JwksKeyEntity>,
  ) {}

  findActive(now: Date): Promise<StoredKey | null> {
    return this.keyRepository.findOne({
      where: { isActive: true, expiresAt: MoreThan(now) },
      order: { createdAt: 'DESC' },
    });
  }

  listVerifiable(cutoff: Date): Promise<StoredKey[]> {
    return this.keyRepository.find({
      where: { expiresAt: MoreThan(cutoff) },
      order: { createdAt: 'DESC' },
    });
  }

  async rotate(next: NewKey): Promise<StoredKey> {
    await this.keyRepository.update({ isActive: true }, { isActive: false });
    return this.keyRepository.save(
      this.keyRepository.create({ ...next, isActive: true }),
    );
  }
}
