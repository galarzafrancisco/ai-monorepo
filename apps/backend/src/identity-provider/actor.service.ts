import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Like, Not, Repository } from 'typeorm';
import { ActorEntity } from './actor.entity';
import { ActorType } from './enums';
import { CreateActorInput } from './dto/service/actor.service.types';
import { SearchService } from '../search/search.service';
import { SearchResult } from '../search/search.types';
import { isUUID } from 'class-validator';

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
   * Create a new actor for a user
   */
  async createUserActor({
    slug,
    displayName,
    avatarUrl,
    introduction,
  }: CreateActorInput): Promise<ActorEntity> {
    this.logger.log(`Creating user actor with slug: ${slug}`);

    const actor = this.actorRepository.create({
      type: ActorType.HUMAN,
      slug,
      displayName,
      avatarUrl: avatarUrl ?? null,
      introduction: introduction ?? null,
    });

    return this.actorRepository.save(actor);
  }

  /**
   * Create a new actor for an agent
   */
  async createAgentActor({
    slug,
    displayName,
    avatarUrl,
    introduction,
  }: CreateActorInput): Promise<ActorEntity> {
    this.logger.log(`Creating agent actor with slug: ${slug}`);

    const actor = this.actorRepository.create({
      type: ActorType.AGENT,
      slug,
      displayName,
      avatarUrl: avatarUrl ?? null,
      introduction: introduction ?? null,
    });

    return this.actorRepository.save(actor);
  }

  /**
   * Get actor by slug
   */
  async getActorBySlug(slug: string): Promise<ActorEntity | null> {
    return this.actorRepository.findOne({
      where: { slug },
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

  async getActorByIdOrSlug(idOrSlug: string): Promise<ActorEntity | null> {
    if (isUUID(idOrSlug)) {
      const actor = await this.getActorById(idOrSlug);
      if (actor) return actor;
    }
    return this.getActorBySlug(idOrSlug);
  }

  /**
   * Resolve an actor that new work can be given to. Deleted actors stay
   * readable through getActorByIdOrSlug but are not assignable.
   */
  async getActiveActorByIdOrSlug(idOrSlug: string): Promise<ActorEntity | null> {
    const actor = await this.getActorByIdOrSlug(idOrSlug);
    return actor?.deletedAt ? null : actor;
  }

  /**
   * Whether an actor that used to own this slug has been deleted.
   */
  async hasDeletedActorForSlug(slug: string): Promise<boolean> {
    return this.actorRepository.existsBy({
      slug: Like(`${slug}${DELETED_SLUG_MARKER}%`),
      deletedAt: Not(IsNull()),
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
   * Check if a slug is already taken
   */
  async isSlugTaken(slug: string): Promise<boolean> {
    const count = await this.actorRepository.count({ where: { slug } });
    return count > 0;
  }

  /**
   * List all actors. Deleted actors are included by default so callers can
   * still attribute past work to them.
   */
  async listActors({
    includeDeleted = true,
  }: { includeDeleted?: boolean } = {}): Promise<ActorEntity[]> {
    return this.actorRepository.find({
      where: includeDeleted ? {} : { deletedAt: IsNull() },
      order: { displayName: 'ASC' },
    });
  }

  /**
   * Search actors by display name or slug using fuzzy search
   */
  async searchActors({
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
    const actors = await this.listActors({ includeDeleted: false });

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
