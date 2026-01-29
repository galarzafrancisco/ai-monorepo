import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActorEntity } from './actor.entity';
import { ActorType } from './enums';
import { CreateActorInput } from './dto/service/actor.service.types';
import { SearchService } from '../search/search.service';
import { SearchResult } from '../search/search.types';

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
  }: CreateActorInput): Promise<ActorEntity> {
    this.logger.log(`Creating user actor with slug: ${slug}`);

    const actor = this.actorRepository.create({
      type: ActorType.HUMAN,
      slug,
      displayName,
      avatarUrl: avatarUrl ?? null,
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
  }: CreateActorInput): Promise<ActorEntity> {
    this.logger.log(`Creating agent actor with slug: ${slug}`);

    const actor = this.actorRepository.create({
      type: ActorType.AGENT,
      slug,
      displayName,
      avatarUrl: avatarUrl ?? null,
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
    const actor = await this.getActorById(idOrSlug);
    if (actor) return actor;
    return this.getActorBySlug(idOrSlug);
  }

  /**
   * Update an actor
   */
  async updateActor(
    id: string,
    updates: { displayName?: string; avatarUrl?: string | null },
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
   * List all actors
   */
  async listActors(): Promise<ActorEntity[]> {
    return this.actorRepository.find({
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

    // Get all actors
    const actors = await this.listActors();

    // Use search service for fuzzy search
    const results = this.searchService.search({
      items: actors,
      primaryField: 'displayName',
      secondaryField: 'slug',
      query,
      limit,
      threshold,
    });

    return results;
  }
}
