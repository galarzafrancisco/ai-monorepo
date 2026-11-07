import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Like, Not, Raw, Repository } from 'typeorm';
import { ActorEntity } from './actor.entity';
import { ActorType } from './enums';
import { CreateActorInput } from './dto/service/actor.service.types';
import { SearchService } from '../search/search.service';
import { SearchResult } from '../search/search.types';
import { isUUID } from 'class-validator';
import { claimActorSlug } from './actor-slug';
import { UserSlugConflictError } from './errors/identity-provider.errors';

/**
 * Separates an actor's original slug from the suffix it gets when deleted.
 */
export const DELETED_SLUG_MARKER = '~deleted-';

/**
 * Slug a deleted actor moves to, so its original slug can be used again.
 */
export function buildDeletedActorSlug(actor: { id: string; slug: string }): string {
  return `${actor.slug}${DELETED_SLUG_MARKER}${actor.id.slice(0, 8)}`;
}

@Injectable()
export class ActorService {
  private readonly logger = new Logger(ActorService.name);

  constructor(
    @InjectRepository(ActorEntity)
    private readonly actorRepository: Repository<ActorEntity>,
    private readonly searchService: SearchService,
  ) {}

  /**
   * Creates a person's actor inside `manager`'s transaction. The slug is
   * claimed first (see `claimActorSlug`), so it can't be any other actor's.
   */
  async createUserActor(
    manager: EntityManager,
    { slug, displayName, avatarUrl, introduction }: CreateActorInput,
  ): Promise<ActorEntity> {
    this.logger.log(`Creating user actor with slug: ${slug}`);
    await this.claimPersonSlug(manager, slug);
    return manager.save(
      ActorEntity,
      manager.create(ActorEntity, {
        type: ActorType.HUMAN,
        slug,
        displayName,
        avatarUrl: avatarUrl ?? null,
        introduction: introduction ?? null,
      }),
    );
  }

  /**
   * Claims a person's slug inside `manager`'s transaction, or throws
   * UserSlugConflictError if another actor has it.
   */
  async claimPersonSlug(
    manager: EntityManager,
    slug: string,
    selfActorId?: string,
  ): Promise<void> {
    const free = await claimActorSlug(manager, {
      type: ActorType.HUMAN,
      slug,
      selfActorId,
    });
    if (!free) {
      throw new UserSlugConflictError(slug);
    }
  }

  /**
   * The actor with this slug among the workspace's members. A person's slug
   * is unique across the installation, but an agent's only in its
   * workspace, so a slug always resolves within a workspace: `@claude-dev`
   * in one workspace is not `@claude-dev` in another.
   */
  async getActorBySlug(
    workspaceId: string,
    slug: string,
  ): Promise<ActorEntity | null> {
    return this.actorRepository.findOne({
      where: { slug, id: memberOfWorkspace(workspaceId) },
    });
  }

  /**
   * Get actor by ID
   */
  async getActorById(
    id: string,
    withUser?: boolean,
  ): Promise<ActorEntity | null> {
    return this.actorRepository.findOne({
      where: { id },
      relations: { user: withUser },
    });
  }

  /** By id (unambiguous), or else by slug among the workspace's members. */
  async getActorByIdOrSlug(
    workspaceId: string,
    idOrSlug: string,
  ): Promise<ActorEntity | null> {
    if (isUUID(idOrSlug)) {
      const actor = await this.getActorById(idOrSlug);
      if (actor) return actor;
    }
    return this.getActorBySlug(workspaceId, idOrSlug);
  }

  /**
   * Resolve an actor that new work can be given to. Deleted actors stay
   * readable through getActorByIdOrSlug but are not assignable.
   */
  async getActiveActorByIdOrSlug(
    workspaceId: string,
    idOrSlug: string,
  ): Promise<ActorEntity | null> {
    const actor = await this.getActorByIdOrSlug(workspaceId, idOrSlug);
    return actor?.deletedAt ? null : actor;
  }

  /**
   * Whether an actor of the workspace that used to own this slug has been
   * deleted.
   */
  async hasDeletedActorForSlug(
    workspaceId: string,
    slug: string,
  ): Promise<boolean> {
    return this.actorRepository.existsBy({
      slug: Like(`${slug}${DELETED_SLUG_MARKER}%`),
      deletedAt: Not(IsNull()),
      id: memberOfWorkspace(workspaceId),
    });
  }

  /**
   * Update an actor
   */
  async updateActor(
    id: string,
    updates: {
      displayName?: string;
      avatarUrl?: string | null;
      introduction?: string | null;
    },
  ): Promise<ActorEntity | null> {
    const actor = await this.actorRepository.findOne({ where: { id } });
    if (!actor) {
      return null;
    }

    if (updates.displayName !== undefined) {
      actor.displayName = updates.displayName;
    }
    if (updates.avatarUrl !== undefined) {
      actor.avatarUrl = updates.avatarUrl;
    }
    if (updates.introduction !== undefined) {
      actor.introduction = updates.introduction;
    }

    return this.actorRepository.save(actor);
  }

  /**
   * List all actors. Deleted actors are included by default so callers can
   * still attribute past work to them.
   */
  /** The actors who are members of a workspace (people and agents). */
  async listActors(
    workspaceId: string,
    { includeDeleted = true }: { includeDeleted?: boolean } = {},
  ): Promise<ActorEntity[]> {
    const id = memberOfWorkspace(workspaceId);
    return this.actorRepository.find({
      where: includeDeleted ? { id } : { id, deletedAt: IsNull() },
      order: { displayName: 'ASC' },
    });
  }

  /**
   * Search actors by display name or slug using fuzzy search
   */
  async searchActors(workspaceId: string, {
    query,
    limit,
    threshold,
  }: {
    query: string;
    limit?: number;
    threshold?: number;
  }): Promise<SearchResult<ActorEntity>[]> {
    this.logger.log(`Searching actors with query: ${query}`);

    // Deleted actors cannot be picked for new work, so they are not searchable
    const actors = await this.listActors(workspaceId, { includeDeleted: false });

    // Use search service for fuzzy search
    const results = this.searchService.search({
      items: actors,
      primaryField: 'displayName',
      secondaryField: 'slug',
      additionalFields: ['introduction'],
      query,
      limit,
      threshold,
    });

    return results;
  }
}

/** A `where` value for an actor id column: the actor is a member of the workspace. */
function memberOfWorkspace(workspaceId: string) {
  return Raw(
    (alias) =>
      `${alias} IN (SELECT actor_id FROM workspace_members WHERE workspace_id = :actorWorkspaceId)`,
    { actorWorkspaceId: workspaceId },
  );
}
