import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
   * Makes sure the default workspace exists (schema-sync databases skip the
   * migration that creates it) and puts every actor with no membership in
   * it. Runs on every startup and is idempotent.
   */
  async onModuleInit(): Promise<void> {
    await this.ensureDefaultWorkspace();
    const added = await this.backfillDefaultMemberships();
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

  private async ensureDefaultWorkspace(): Promise<void> {
    await this.workspaceRepository
      .createQueryBuilder()
      .insert()
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
   * workspace, with the role from `workspaceRoleForUserRole` (agents have no
   * user row and become members). Existing memberships are left alone.
   *
   * @returns how many memberships were added
   */
  private async backfillDefaultMemberships(): Promise<number> {
    const actors: { actorId: string; userRole: string | null }[] =
      await this.memberRepository.manager.query(`
        SELECT a."id" AS "actorId", u."role" AS "userRole"
        FROM "actors" a
        LEFT JOIN "users" u ON u."actor_id" = a."id"
        WHERE NOT EXISTS (
          SELECT 1 FROM "workspace_members" m WHERE m."actor_id" = a."id"
        )
      `);
    if (actors.length === 0) {
      return 0;
    }
    await this.memberRepository
      .createQueryBuilder()
      .insert()
      .values(
        actors.map(({ actorId, userRole }) => ({
          workspaceId: DEFAULT_WORKSPACE_ID,
          actorId,
          role: workspaceRoleForUserRole(userRole ?? ''),
        })),
      )
      .orIgnore()
      .execute();
    return actors.length;
  }
}
