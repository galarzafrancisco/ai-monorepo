import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WikiPageEntity } from './page.entity';
import { WikiTagEntity } from './tag.entity';
import {
  AddTagInput,
  AppendPageInput,
  CreatePageInput,
  PageResult,
  PageSummaryResult,
  TagResult,
  UpdatePageInput,
} from './dto/service/wikiroo.service.types';
import { PageNotFoundError } from './errors/wikiroo.errors';

@Injectable()
export class WikirooService {
  private readonly logger = new Logger(WikirooService.name);

  constructor(
    @InjectRepository(WikiPageEntity)
    private readonly pageRepository: Repository<WikiPageEntity>,
    @InjectRepository(WikiTagEntity)
    private readonly tagRepository: Repository<WikiTagEntity>,
  ) {}

  async createPage(input: CreatePageInput): Promise<PageResult> {
    this.logger.log({
      message: 'Creating wiki page',
      title: input.title,
      author: input.author,
    });

    const page = this.pageRepository.create({
      title: input.title,
      content: input.content,
      author: input.author,
      tags: [],
    });

    const saved = await this.pageRepository.save(page);

    this.logger.log({
      message: 'Wiki page created',
      pageId: saved.id,
    });

    return this.mapToResult(saved);
  }

  async listPages(): Promise<PageSummaryResult[]> {
    this.logger.log({ message: 'Listing wiki pages' });

    const pages = await this.pageRepository.find({
      relations: ['tags'],
      order: { createdAt: 'DESC' },
    });

    return pages.map((page) => this.mapToSummary(page));
  }

  async getPageById(pageId: string): Promise<PageResult> {
    this.logger.log({ message: 'Fetching wiki page', pageId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    return this.mapToResult(page);
  }

  async updatePage(
    pageId: string,
    input: UpdatePageInput,
  ): Promise<PageResult> {
    this.logger.log({ message: 'Updating wiki page', pageId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    if (input.title !== undefined) {
      page.title = input.title;
    }
    if (input.content !== undefined) {
      page.content = input.content;
    }
    if (input.author !== undefined) {
      page.author = input.author;
    }

    const saved = await this.pageRepository.save(page);

    this.logger.log({ message: 'Wiki page updated', pageId: saved.id });

    return this.mapToResult(saved);
  }

  async appendToPage(
    pageId: string,
    input: AppendPageInput,
  ): Promise<PageResult> {
    this.logger.log({ message: 'Appending wiki page content', pageId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    page.content = `${page.content}${input.content}`;

    const saved = await this.pageRepository.save(page);

    this.logger.log({ message: 'Wiki page content appended', pageId: saved.id });

    return this.mapToResult(saved);
  }

  async deletePage(pageId: string): Promise<void> {
    this.logger.log({ message: 'Deleting wiki page', pageId });

    const result = await this.pageRepository.delete(pageId);

    if (!result.affected) {
      throw new PageNotFoundError(pageId);
    }

    this.logger.log({ message: 'Wiki page deleted', pageId });
  }

  async addTagToPage(pageId: string, input: AddTagInput): Promise<PageResult> {
    this.logger.log({ message: 'Adding tag to page', pageId, tagName: input.name });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    // Find or create the tag
    let tag = await this.tagRepository.findOne({ where: { name: input.name } });

    if (!tag) {
      tag = this.tagRepository.create({
        name: input.name,
        color: input.color,
        description: input.description,
      });
      tag = await this.tagRepository.save(tag);
    }

    // Add tag to page if not already present
    if (!page.tags.some((t) => t.id === tag.id)) {
      page.tags.push(tag);
      await this.pageRepository.save(page);
    }

    // Reload with relations
    const pageWithRelations = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    this.logger.log({ message: 'Tag added to page', pageId, tagId: tag.id });

    return this.mapToResult(pageWithRelations!);
  }

  async removeTagFromPage(pageId: string, tagId: string): Promise<PageResult> {
    this.logger.log({ message: 'Removing tag from page', pageId, tagId });

    const page = await this.pageRepository.findOne({
      where: { id: pageId },
      relations: ['tags'],
    });

    if (!page) {
      throw new PageNotFoundError(pageId);
    }

    page.tags = page.tags.filter((tag) => tag.id !== tagId);
    await this.pageRepository.save(page);

    this.logger.log({ message: 'Tag removed from page', pageId, tagId });

    return this.mapToResult(page);
  }

  async getAllTags(): Promise<TagResult[]> {
    this.logger.log({ message: 'Getting all tags' });

    const tags = await this.tagRepository.find({
      order: { name: 'ASC' },
    });

    return tags.map((tag) => this.mapTagToResult(tag));
  }

  async listPagesByTag(tagName: string): Promise<PageResult[]> {
    this.logger.log({ message: 'Listing pages by tag', tagName });

    const tag = await this.tagRepository.findOne({
      where: { name: tagName },
      relations: ['pages', 'pages.tags'],
    });

    if (!tag) {
      return [];
    }

    return tag.pages.map((page) => this.mapToResult(page));
  }

  private mapToResult(page: WikiPageEntity): PageResult {
    return {
      id: page.id,
      title: page.title,
      content: page.content,
      author: page.author,
      tags: (page.tags || []).map((tag) => this.mapTagToResult(tag)),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  private mapToSummary(page: WikiPageEntity): PageSummaryResult {
    return {
      id: page.id,
      title: page.title,
      author: page.author,
      tags: (page.tags || []).map((tag) => this.mapTagToResult(tag)),
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  private mapTagToResult(tag: WikiTagEntity): TagResult {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      description: tag.description,
      createdAt: tag.createdAt,
      updatedAt: tag.updatedAt,
    };
  }
}
