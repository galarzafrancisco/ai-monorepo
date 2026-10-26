import { createHash } from 'crypto';
import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../identity-provider/user.entity';
import { ActorEntity } from '../identity-provider/actor.entity';
import { AccessRequestEntity } from './access-request.entity';

export interface ListAccessRequestsParams {
  status?: 'new' | 'reviewed';
  search?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AccessRequestsService {
  constructor(
    @InjectRepository(AccessRequestEntity) private readonly repo: Repository<AccessRequestEntity>,
    @InjectRepository(ActorEntity) private readonly actors: Repository<ActorEntity>,
  ) {}

  static hashIp(ip: string | undefined): string | null {
    return ip ? createHash('sha256').update(`taico-access-request:${ip}`).digest('hex') : null;
  }

  /**
   * Stores a request. Duplicates (same email, case-insensitive) update the
   * existing row rather than erroring, so callers cannot learn whether an
   * email was submitted before.
   */
  async submit(input: { email: string; building?: string | null; ipHash: string | null }): Promise<void> {
    const email = input.email.trim();
    const building = input.building?.trim() ? input.building.trim() : null;
    await this.repo.query(
      `INSERT INTO "access_requests" ("email", "email_normalized", "building", "ip_hash")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("email_normalized") DO UPDATE SET
         "submission_count" = "access_requests"."submission_count" + 1,
         "last_submitted_at" = now(),
         "updated_at" = now(),
         "building" = COALESCE(EXCLUDED."building", "access_requests"."building")`,
      [email, email.toLowerCase(), building, input.ipHash],
    );
  }

  async list(params: ListAccessRequestsParams) {
    const qb = this.repo.createQueryBuilder('r').orderBy('r.createdAt', 'DESC');
    if (params.status) qb.andWhere('r.status = :status', { status: params.status });
    if (params.search) {
      const term = `%${params.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere('(r.email ILIKE :term OR r.building ILIKE :term)', { term });
    }
    qb.take(params.limit ?? 50).skip(params.offset ?? 0);
    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async setStatus(id: string, status: 'new' | 'reviewed', actorId: string) {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Access request not found');
    row.status = status;
    row.reviewedAt = status === 'reviewed' ? new Date() : null;
    row.reviewedByActorId = status === 'reviewed' ? actorId : null;
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new NotFoundException('Access request not found');
  }

  /** Server-side admin check, independent of any UI. */
  async assertAdmin(actorId: string): Promise<void> {
    const actor = await this.actors.findOne({ where: { id: actorId }, relations: { user: true } });
    const user: User | undefined | null = actor?.user;
    if (!user || !user.isActive) throw new UnauthorizedException('User not found');
    if (user.role !== 'admin') throw new ForbiddenException('Admin access required');
  }
}
