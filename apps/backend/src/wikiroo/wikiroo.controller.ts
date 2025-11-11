import {
  All,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from "express";
import { WikirooService } from './wikiroo.service';
import { CreatePageDto } from './dto/create-page.dto';
import { PageResponseDto } from './dto/page-response.dto';
import { PageListResponseDto } from './dto/page-list-response.dto';
import { PageSummaryDto } from './dto/page-summary.dto';
import { PageParamsDto } from './dto/page-params.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { AppendPageDto } from './dto/append-page.dto';
import { AddWikiTagDto } from './dto/add-wiki-tag.dto';
import { WikiTagResponseDto } from './dto/wiki-tag-response.dto';
import { PageResult, PageSummaryResult, TagResult } from './dto/service/wikiroo.service.types';
import { WikirooMcpGateway } from './wikiroo.mcp.gateway';

@ApiTags('Wikiroo')
@Controller('wikiroo/pages')
export class WikirooController {
  constructor(
    private readonly wikirooService: WikirooService,
    private readonly gateway: WikirooMcpGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new wiki page' })
  @ApiCreatedResponse({
    type: PageResponseDto,
    description: 'Wiki page created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createPage(@Body() dto: CreatePageDto): Promise<PageResponseDto> {
    const result = await this.wikirooService.createPage({
      title: dto.title,
      content: dto.content,
      author: dto.author,
    });

    return this.mapToResponse(result);
  }

  @Get()
  @ApiOperation({ summary: 'List wiki pages without content' })
  @ApiOkResponse({
    type: PageListResponseDto,
    description: 'List of wiki pages',
  })
  async listPages(): Promise<PageListResponseDto> {
    const items = await this.wikirooService.listPages();
    return {
      items: items.map((item) => this.mapToSummary(item)),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a wiki page by ID' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Wiki page retrieved successfully',
  })
  async getPage(@Param() params: PageParamsDto): Promise<PageResponseDto> {
    const result = await this.wikirooService.getPageById(params.id);
    return this.mapToResponse(result);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing wiki page' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Wiki page updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'No update fields provided',
  })
  async updatePage(
    @Param() params: PageParamsDto,
    @Body() dto: UpdatePageDto,
  ): Promise<PageResponseDto> {
    if (
      dto.title === undefined &&
      dto.content === undefined &&
      dto.author === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const result = await this.wikirooService.updatePage(params.id, {
      title: dto.title,
      content: dto.content,
      author: dto.author,
    });

    return this.mapToResponse(result);
  }

  @Post(':id/append')
  @ApiOperation({ summary: 'Append content to an existing wiki page' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Wiki page content appended successfully',
  })
  async appendToPage(
    @Param() params: PageParamsDto,
    @Body() dto: AppendPageDto,
  ): Promise<PageResponseDto> {
    const result = await this.wikirooService.appendToPage(params.id, {
      content: dto.content,
    });

    return this.mapToResponse(result);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a wiki page' })
  @ApiNoContentResponse({ description: 'Wiki page deleted successfully' })
  async deletePage(@Param() params: PageParamsDto): Promise<void> {
    await this.wikirooService.deletePage(params.id);
  }

  @Post(':id/tags')
  @ApiOperation({ summary: 'Add a tag to a wiki page' })
  @ApiCreatedResponse({
    type: PageResponseDto,
    description: 'Tag added to page successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addTagToPage(
    @Param() params: PageParamsDto,
    @Body() dto: AddWikiTagDto,
  ): Promise<PageResponseDto> {
    const result = await this.wikirooService.addTagToPage(params.id, {
      name: dto.name,
      color: dto.color,
      description: dto.description,
    });
    return this.mapToResponse(result);
  }

  @Delete(':id/tags/:tagId')
  @ApiOperation({ summary: 'Remove a tag from a wiki page' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Tag removed from page successfully',
  })
  async removeTagFromPage(
    @Param('id') pageId: string,
    @Param('tagId') tagId: string,
  ): Promise<PageResponseDto> {
    const result = await this.wikirooService.removeTagFromPage(pageId, tagId);
    return this.mapToResponse(result);
  }

  @Get('tags/all')
  @ApiOperation({ summary: 'Get all tags' })
  @ApiOkResponse({
    type: [WikiTagResponseDto],
    description: 'List of all tags',
  })
  async getAllTags(): Promise<WikiTagResponseDto[]> {
    const result = await this.wikirooService.getAllTags();
    return result.map((tag) => this.mapTagToResponse(tag));
  }

  @Get('tags/:name/pages')
  @ApiOperation({ summary: 'List pages by tag name' })
  @ApiOkResponse({
    type: [PageResponseDto],
    description: 'List of pages with the specified tag',
  })
  async listPagesByTag(@Param('name') tagName: string): Promise<PageResponseDto[]> {
    const result = await this.wikirooService.listPagesByTag(tagName);
    return result.map((page) => this.mapToResponse(page));
  }

  private mapToResponse(result: PageResult): PageResponseDto {
    return {
      id: result.id,
      title: result.title,
      content: result.content,
      author: result.author,
      tags: result.tags.map((tag) => this.mapTagToResponse(tag)),
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapToSummary(result: PageSummaryResult): PageSummaryDto {
    return {
      id: result.id,
      title: result.title,
      author: result.author,
      tags: result.tags.map((tag) => this.mapTagToResponse(tag)),
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapTagToResponse(result: TagResult): WikiTagResponseDto {
    return {
      id: result.id,
      name: result.name,
      color: result.color,
      description: result.description,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  @All('mcp')
  async handleMcp(@Req() req: Request, @Res() res: Response) {
    await this.gateway.handleRequest(req, res);
  }
}
