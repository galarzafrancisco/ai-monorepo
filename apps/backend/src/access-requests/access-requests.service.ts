import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccessRequestEntity } from './access-request.entity';
import { AccessRequestStatus } from './enums';
import { AccessRequestNotFoundError, AccessRequestsBusyError } from './errors/access-requests.errors';
import { SubmissionCeiling } from './submission-ceiling';
import {
  AccessRequestListResult,
  AccessRequestResult,
  ListAccessRequestsInput,
  SubmitAccessRequestInput,
} from './dto/service/access-requests.service.types';

/** Accepted public submissions per backend process per hour. */
export const ACCESS_REQUEST_HOURLY_CEILING = 300;

@Injectable()
export class AccessRequestsService {
  private readonly ceiling = new SubmissionCeiling(ACCESS_REQUEST_HOURLY_CEILING, 60 * 60 * 1000);

  constructor(
    @InjectRepository(AccessRequestEntity)
    private readonly repo: Repository<AccessRequestEntity>,
  ) {}

  /**
   * Stores an expression of interest. A repeat submission for the same email
   * (case-insensitive) updates the existing row instead of erroring, so the
   * caller always gets the same answer and cannot learn whether an email was
   * submitted before. Never logs the submitted values.
   */
  async submit(input: SubmitAccessRequestInput): Promise<void> {
    if (!this.ceiling.tryHit()) throw new AccessRequestsBusyError();

    const email = input.email.trim();
    const building = input.building?.trim() ? input.building.trim() : null;
    await this.repo.query(
      `INSERT INTO "access_requests" ("email", "email_normalized", "building")
       VALUES ($1, $2, $3)
       ON CONFLICT ("email_normalized") DO UPDATE SET
         "submission_count" = "access_requests"."submission_count" + 1,
         "last_submitted_at" = now(),
         "updated_at" = now(),
         "building" = COALESCE(EXCLUDED."building", "access_requests"."building")`,
      [email, email.toLowerCase(), building],
    );
  }

  /** Most recently submitted first, so a retry of an old request resurfaces. */
  async list(input: ListAccessRequestsInput): Promise<AccessRequestListResult> {
    const qb = this.repo
      .createQueryBuilder('r')
      .orderBy('r.lastSubmittedAt', 'DESC')
      .addOrderBy('r.createdAt', 'DESC');
    if (input.status) qb.andWhere('r.status = :status', { status: input.status });
    if (input.search) {
      const term = `%${input.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      qb.andWhere('(r.email ILIKE :term OR r.building ILIKE :term)', { term });
    }
    qb.take(input.limit ?? 50).skip(input.offset ?? 0);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toResult), total };
  }

  async setStatus(id: string, status: AccessRequestStatus, actorId: string): Promise<AccessRequestResult> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new AccessRequestNotFoundError(id);
    const reviewed = status === AccessRequestStatus.REVIEWED;
    row.status = status;
    row.reviewedAt = reviewed ? new Date() : null;
    row.reviewedByActorId = reviewed ? actorId : null;
    return toResult(await this.repo.save(row));
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete({ id });
    if (!res.affected) throw new AccessRequestNotFoundError(id);
  }
}

function toResult(r: AccessRequestEntity): AccessRequestResult {
  return {
    id: r.id,
    email: r.email,
    building: r.building,
    status: r.status,
    submissionCount: r.submissionCount,
    createdAt: r.createdAt,
    lastSubmittedAt: r.lastSubmittedAt,
    reviewedAt: r.reviewedAt,
  };
}
