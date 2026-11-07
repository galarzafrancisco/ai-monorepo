import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { ActorEntity } from '../identity-provider/actor.entity';
import { User } from '../identity-provider/user.entity';
import { WorkspaceMemberEntity } from './workspace-member.entity';
import { WorkspaceRole } from './enums';
import { DEFAULT_WORKSPACE_ID } from './workspaces.constants';
import { workspaceRoleForUserRole } from './workspaces.service';

/**
 * Puts every new actor in the default workspace, and keeps a person's
 * workspace role in step with their installation-wide role (`users.role`).
 *
 * Actors are created in several places (people, agents, seeds), so this
 * hooks the inserts rather than each caller. It runs in the same transaction
 * as the insert. A role change made with `update()` instead of `save()`
 * carries no actor id and is not seen. Once Taico can hold more than one
 * workspace, the workspace comes from whoever creates the actor and this
 * goes away.
 */
@Injectable()
export class WorkspaceMembershipSubscriber
  implements EntitySubscriberInterface
{
  constructor(@InjectDataSource() dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  async afterInsert(event: InsertEvent<unknown>): Promise<void> {
    if (event.metadata.target === ActorEntity) {
      const actor = event.entity as ActorEntity;
      await this.addDefaultMembership(event.manager, actor.id);
      return;
    }
    if (event.metadata.target === User) {
      const user = event.entity as User;
      await this.setDefaultMembershipRole(event.manager, user);
    }
  }

  async afterUpdate(event: UpdateEvent<unknown>): Promise<void> {
    if (event.metadata.target !== User || !event.entity) {
      return;
    }
    const roleChanged = event.updatedColumns.some(
      (column) => column.propertyName === 'role',
    );
    if (!roleChanged) {
      return;
    }
    const user = event.entity as User;
    if (!user.actorId) {
      return;
    }
    await this.setDefaultMembershipRole(event.manager, user);
  }

  /** Adds the actor to the default workspace as a member, if not already in it. */
  private async addDefaultMembership(
    manager: EntityManager,
    actorId: string,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(WorkspaceMemberEntity)
      .values({
        workspaceId: DEFAULT_WORKSPACE_ID,
        actorId,
        role: WorkspaceRole.MEMBER,
      })
      .orIgnore()
      .execute();
  }

  /** Sets the person's default-workspace role from `users.role`, adding the membership if missing. */
  private async setDefaultMembershipRole(
    manager: EntityManager,
    user: User,
  ): Promise<void> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(WorkspaceMemberEntity)
      .values({
        workspaceId: DEFAULT_WORKSPACE_ID,
        actorId: user.actorId,
        role: workspaceRoleForUserRole(user.role),
      })
      .orUpdate(['role'], ['workspace_id', 'actor_id'])
      .execute();
  }
}
