import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WikiPageEntity } from './page.entity';
import {
  AppendPageInput,
  CreatePageInput,
  PageResult,
  PageSummaryResult,
  UpdatePageInput,
} from './dto/service/wikiroo.service.types';
import { PageNotFoundError } from './errors/wikiroo.errors';

@Injectable()
export class WikirooService {
  private readonly logger = new Logger(WikirooService.name);

  constructor(
    @InjectRepository(WikiPageEntity)
    private readonly pageRepository: Repository<WikiPageEntity>,
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
      select: {
        id: true,
        title: true,
        author: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' },
    });

    return pages.map((page) => this.mapToSummary(page));
  }

  async getPageById(pageId: string): Promise<PageResult> {
    this.logger.log({ message: 'Fetching wiki page', pageId });

    const page = await this.pageRepository.findOne({ where: { id: pageId } });

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

    const page = await this.pageRepository.findOne({ where: { id: pageId } });

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

    const page = await this.pageRepository.findOne({ where: { id: pageId } });

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

  private mapToResult(page: WikiPageEntity): PageResult {
    return {
      id: page.id,
      title: page.title,
      content: page.content,
      author: page.author,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }

  private mapToSummary(page: Pick<
    WikiPageEntity,
    'id' | 'title' | 'author' | 'createdAt' | 'updatedAt'
  >): PageSummaryResult {
    return {
      id: page.id,
      title: page.title,
      author: page.author,
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    };
  }
}
