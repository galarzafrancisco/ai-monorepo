import { Injectable, OnModuleInit } from '@nestjs/common';
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
import { ActorEntity } from '../identity-provider/actor.entity';
import { ActorType } from '../identity-provider/enums';
import {
  WorkspaceLastAdminError,
  WorkspaceMemberAlreadyExistsError,
  WorkspaceMemberIsAgentError,
  WorkspaceMemberNotFoundError,
  WorkspaceSlugConflictError,
} from './workspace.errors';

/** A workspace an actor belongs to, with their role in it. */
export type WorkspaceMembershipResult = {
  workspaceId: string;
  slug: string;
  name: string;
  role: WorkspaceRole;
};

/** A member of a workspace, with the actor's public details. */
export type WorkspaceMemberResult = {
  actorId: string;
  type: ActorType;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: Date;
};

/**
 * Adds an actor to a workspace inside the caller's transaction. Every place
 * that creates an actor calls this (or `AgentsService.createAgent`), so no
 * actor is left without a workspace. Does nothing if the actor is already a
 * member.
 */
export async function addWorkspaceMembership(
  manager: EntityManager,
  membership: { workspaceId: string; actorId: string; role: WorkspaceRole },
): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into(WorkspaceMemberEntity)
    .values(membership)
    .orIgnore()
    .execute();
}

@Injectable()
export class WorkspacesService implements OnModuleInit {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepository: Repository<WorkspaceEntity>,
    @InjectRepository(WorkspaceMemberEntity)
    private readonly memberRepository: Repository<WorkspaceMemberEntity>,
  ) {}

  /**
   * Makes sure the default workspace exists (schema-sync databases skip the
   * migration that creates it). Runs on every startup and is idempotent.
   *
   * Memberships are not backfilled here any more: every actor is given one
   * when it is created, and a person removed from every workspace must not
   * be put back in the default one on restart.
   */
  async onModuleInit(): Promise<void> {
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

  /** Ids of every workspace that is not deleted. */
  async listWorkspaceIds(): Promise<string[]> {
    const workspaces = await this.workspaceRepository.find({
      select: { id: true },
    });
    return workspaces.map((workspace) => workspace.id);
  }

  /** Whether an actor is a member of a workspace. */
  async isMember(workspaceId: string, actorId: string): Promise<boolean> {
    return (await this.findRole(workspaceId, actorId)) !== null;
  }

  /** The actor's role in a workspace that is not deleted; null if they are not a member. */
  async findRole(
    workspaceId: string,
    actorId: string,
  ): Promise<WorkspaceRole | null> {
    const membership = await this.liveMemberships()
      .where('m.workspace_id = :workspaceId', { workspaceId })
      .andWhere('m.actor_id = :actorId', { actorId })
      .getOne();
    return membership?.role ?? null;
  }

  /**
   * The workspace an actor works in when nothing else says which: their
   * oldest membership. Null if the actor has no membership at all.
   */
  async findWorkspaceIdForActor(actorId: string): Promise<string | null> {
    return (await this.findMembershipForActor(actorId))?.workspaceId ?? null;
  }

  /**
   * The membership of the workspace an actor works in (see
   * `findWorkspaceIdForActor`), with its role; null if none.
   */
  async findMembershipForActor(
    actorId: string,
  ): Promise<{ workspaceId: string; role: WorkspaceRole } | null> {
    const membership = await this.liveMemberships()
      .where('m.actor_id = :actorId', { actorId })
      .orderBy('m.created_at', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .getOne();
    return membership
      ? { workspaceId: membership.workspaceId, role: membership.role }
      : null;
  }

  /** Every workspace the actor belongs to, oldest membership first. */
  async listWorkspacesForActor(
    actorId: string,
  ): Promise<WorkspaceMembershipResult[]> {
    const memberships = await this.liveMemberships()
      .where('m.actor_id = :actorId', { actorId })
      .orderBy('m.created_at', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .getMany();
    return memberships.map((m) => ({
      workspaceId: m.workspaceId,
      slug: m.workspace!.slug,
      name: m.workspace!.name,
      role: m.role,
    }));
  }

  /**
   * Creates a workspace with `adminActorId` as its first admin. Seeding the
   * workspace's own rows (tags, agents, providers) is
   * `WorkspaceProvisioningService`'s job.
   *
   * @throws {WorkspaceSlugConflictError} if the slug is taken
   */
  async createWorkspace(input: {
    name: string;
    slug: string;
    adminActorId: string;
  }): Promise<WorkspaceEntity> {
    try {
      return await this.workspaceRepository.manager.transaction(
        async (manager) => {
          const workspace = await manager.save(
            manager.create(WorkspaceEntity, {
              name: input.name,
              slug: input.slug,
            }),
          );
          await addWorkspaceMembership(manager, {
            workspaceId: workspace.id,
            actorId: input.adminActorId,
            role: WorkspaceRole.ADMIN,
          });
          return workspace;
        },
      );
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new WorkspaceSlugConflictError(input.slug);
      }
      throw error;
    }
  }

  /** The workspace, or null if it is deleted or does not exist. */
  async findWorkspace(workspaceId: string): Promise<WorkspaceEntity | null> {
    return this.workspaceRepository.findOneBy({ id: workspaceId });
  }

  /** The workspace's members (people and agents) whose actor is not deleted. */
  async listMembers(workspaceId: string): Promise<WorkspaceMemberResult[]> {
    const rows = await this.memberRepository
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.actor', 'a')
      .where('m.workspace_id = :workspaceId', { workspaceId })
      .andWhere('a.deleted_at IS NULL')
      .orderBy('m.created_at', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .getMany();
    return rows.map((row) => this.toMemberResult(row, row.actor!));
  }

  /** One member of the workspace, or null if the actor is not a (live) member. */
  async getMember(
    workspaceId: string,
    actorId: string,
  ): Promise<WorkspaceMemberResult | null> {
    const row = await this.memberRepository
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.actor', 'a')
      .where('m.workspace_id = :workspaceId', { workspaceId })
      .andWhere('m.actor_id = :actorId', { actorId })
      .andWhere('a.deleted_at IS NULL')
      .getOne();
    return row ? this.toMemberResult(row, row.actor!) : null;
  }

  /**
   * Adds a person to the workspace.
   *
   * @throws {WorkspaceMemberIsAgentError} for an agent: agents are created in their workspace
   * @throws {WorkspaceMemberAlreadyExistsError} if they are already a member
   */
  async addMember(
    workspaceId: string,
    actorId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMemberResult> {
    return this.memberRepository.manager.transaction(async (manager) => {
      const actor = await this.lockLiveActor(manager, actorId);
      if (!actor) {
        throw new WorkspaceMemberNotFoundError(actorId);
      }
      if (actor.type === ActorType.AGENT) {
        throw new WorkspaceMemberIsAgentError(actorId);
      }
      const inserted = await manager
        .createQueryBuilder()
        .insert()
        .into(WorkspaceMemberEntity)
        .values({ workspaceId, actorId, role })
        .orIgnore()
        .returning(['id'])
        .execute();
      if (inserted.raw.length === 0) {
        throw new WorkspaceMemberAlreadyExistsError(actorId);
      }
      const member = await manager.findOneByOrFail(WorkspaceMemberEntity, {
        workspaceId,
        actorId,
      });
      return this.toMemberResult(member, actor);
    });
  }

  /**
   * Changes a person's role in the workspace. The new role is in their next
   * token (the `user:admin` scope is decided when a token is minted).
   *
   * @throws {WorkspaceMemberNotFoundError} if they are not a member
   * @throws {WorkspaceMemberIsAgentError} for an agent
   * @throws {WorkspaceLastAdminError} when demoting the last admin
   */
  async setMemberRole(
    workspaceId: string,
    actorId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMemberResult> {
    return this.memberRepository.manager.transaction(async (manager) => {
      const { member, actor } = await this.lockPersonMember(
        manager,
        workspaceId,
        actorId,
      );
      if (member.role === WorkspaceRole.ADMIN && role !== WorkspaceRole.ADMIN) {
        await this.assertAnotherAdmin(manager, workspaceId, actorId);
      }
      if (member.role !== role) {
        await manager.update(
          WorkspaceMemberEntity,
          { id: member.id },
          { role },
        );
        member.role = role;
      }
      return this.toMemberResult(member, actor);
    });
  }

  /**
   * Removes a person from the workspace. Tokens already minted for it stay
   * valid until they expire; the next one (refresh, switch, MCP refresh) is
   * for another workspace or refused.
   *
   * @throws {WorkspaceMemberNotFoundError} if they are not a member
   * @throws {WorkspaceMemberIsAgentError} for an agent: delete the agent instead
   * @throws {WorkspaceLastAdminError} when removing the last admin
   */
  async removeMember(workspaceId: string, actorId: string): Promise<void> {
    await this.memberRepository.manager.transaction(async (manager) => {
      const { member } = await this.lockPersonMember(
        manager,
        workspaceId,
        actorId,
      );
      if (member.role === WorkspaceRole.ADMIN) {
        await this.assertAnotherAdmin(manager, workspaceId, actorId);
      }
      await manager.delete(WorkspaceMemberEntity, { id: member.id });
    });
  }

  /** Memberships of workspaces that are not deleted, with their workspace. */
  private liveMemberships() {
    return this.memberRepository
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.workspace', 'w', 'w.deleted_at IS NULL');
  }

  private async lockLiveActor(
    manager: EntityManager,
    actorId: string,
  ): Promise<ActorEntity | null> {
    return manager
      .createQueryBuilder(ActorEntity, 'a')
      .setLock('pessimistic_write')
      .where('a.id = :actorId', { actorId })
      .andWhere('a.deleted_at IS NULL')
      .getOne();
  }

  /**
   * Locks the workspace row, so concurrent role changes and removals in it
   * run one after the other and the last-admin check holds, then loads the
   * person's membership.
   */
  private async lockPersonMember(
    manager: EntityManager,
    workspaceId: string,
    actorId: string,
  ): Promise<{ member: WorkspaceMemberEntity; actor: ActorEntity }> {
    await manager
      .createQueryBuilder(WorkspaceEntity, 'w')
      .setLock('pessimistic_write')
      .where('w.id = :workspaceId', { workspaceId })
      .getOne();
    const member = await manager.findOneBy(WorkspaceMemberEntity, {
      workspaceId,
      actorId,
    });
    const actor = member ? await this.lockLiveActor(manager, actorId) : null;
    if (!member || !actor) {
      throw new WorkspaceMemberNotFoundError(actorId);
    }
    if (actor.type === ActorType.AGENT) {
      throw new WorkspaceMemberIsAgentError(actorId);
    }
    return { member, actor };
  }

  private async assertAnotherAdmin(
    manager: EntityManager,
    workspaceId: string,
    exceptActorId: string,
  ): Promise<void> {
    const others = await manager
      .createQueryBuilder(WorkspaceMemberEntity, 'm')
      .innerJoin('m.actor', 'a')
      .where('m.workspace_id = :workspaceId', { workspaceId })
      .andWhere('m.role = :role', { role: WorkspaceRole.ADMIN })
      .andWhere('m.actor_id <> :exceptActorId', { exceptActorId })
      .andWhere('a.deleted_at IS NULL')
      .getCount();
    if (others === 0) {
      throw new WorkspaceLastAdminError();
    }
  }

  private toMemberResult(
    member: WorkspaceMemberEntity,
    actor: ActorEntity,
  ): WorkspaceMemberResult {
    return {
      actorId: actor.id,
      type: actor.type,
      slug: actor.slug,
      displayName: actor.displayName,
      avatarUrl: actor.avatarUrl,
      role: member.role,
      joinedAt: member.createdAt,
    };
  }
}
