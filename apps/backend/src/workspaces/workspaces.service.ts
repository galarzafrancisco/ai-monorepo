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
   * The migration creates the default workspace. Databases built by schema
   * sync (tests, local dev) skip migrations, so make sure it exists here too.
   */
  async onModuleInit(): Promise<void> {
    await ensureDefaultWorkspace(this.workspaceRepository.manager);
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
