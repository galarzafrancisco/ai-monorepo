import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { WorkspaceEntity } from './workspace.entity';
import { WorkspaceMemberEntity } from './workspace-member.entity';
import { WorkspaceRole } from './enums';
import {
  DEFAULT_WORKSPACE_ID,
  DEFAULT_WORKSPACE_NAME,
  DEFAULT_WORKSPACE_SLUG,
} from './workspaces.constants';
import { UserRole } from '../identity-provider/enums';

/** The workspace role a person gets from their installation-wide role. */
export function workspaceRoleForUserRole(role: UserRole | string): WorkspaceRole {
  return role === UserRole.ADMIN ? WorkspaceRole.ADMIN : WorkspaceRole.MEMBER;
}

@Injectable()
export class WorkspacesService implements OnModuleInit {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepository: Repository<WorkspaceMemberEntity>,
  ) {}

  /**
   * The migration creates the default workspace and puts every existing
   * actor in it. Databases run with schema sync (`TYPEORM_SCHEMA_MODE=sync`)
   * skip migrations, so do the same here. Both steps are idempotent.
   */
  async onModuleInit(): Promise<void> {
    const manager = this.workspaceRepository.manager;
    await ensureDefaultWorkspace(manager);
    const added = await backfillDefaultMemberships(manager);
    if (added > 0) {
      this.logger.log(`Added ${added} actor(s) to the default workspace`);
    }
  }

  /**
   * The workspace an actor works in. While there is only one workspace this
   * is the default workspace for everyone; null if the actor has no
   * membership at all.
   */
  async findWorkspaceIdForActor(actorId: string): Promise<string | null> {
    const membership = await this.memberRepository.findOne({
      where: { actorId },
      order: { createdAt: 'ASC' },
    });
    return membership?.workspaceId ?? null;
  }

  async findMembership(
    workspaceId: string,
    actorId: string,
  ): Promise<WorkspaceMemberEntity | null> {
    return this.memberRepository.findOne({ where: { workspaceId, actorId } });
  }

  async listMemberships(actorId: string): Promise<WorkspaceMemberEntity[]> {
    return this.memberRepository.find({
      where: { actorId },
      relations: { workspace: true },
      order: { createdAt: 'ASC' },
    });
  }
}

export async function ensureDefaultWorkspace(
  manager: EntityManager,
): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(WorkspaceEntity)
    .values({
      id: DEFAULT_WORKSPACE_ID,
      slug: DEFAULT_WORKSPACE_SLUG,
      name: DEFAULT_WORKSPACE_NAME,
    })
    .orIgnore()
    .execute();
}

/**
 * Puts every actor that has no workspace membership in the default
 * workspace. People who are installation admins become workspace admins,
 * everyone else (and every agent) a member. Matches the Workspaces
 * migration. Existing memberships are left alone.
 *
 * @returns how many memberships were added
 */
export async function backfillDefaultMemberships(
  manager: EntityManager,
): Promise<number> {
  const rows: unknown[] = await manager.query(
    `
    INSERT INTO "workspace_members" ("workspace_id", "actor_id", "role", "row_version")
    SELECT $1, a."id",
      CASE WHEN u."role" = $2 THEN $3::text ELSE $4::text END,
      1
    FROM "actors" a
    LEFT JOIN "users" u ON u."actor_id" = a."id"
    WHERE NOT EXISTS (
      SELECT 1 FROM "workspace_members" m WHERE m."actor_id" = a."id"
    )
    ON CONFLICT ("workspace_id", "actor_id") DO NOTHING
    RETURNING "id"
    `,
    [DEFAULT_WORKSPACE_ID, UserRole.ADMIN, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER],
  );
  return rows.length;
}
