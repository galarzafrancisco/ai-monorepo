import {
  All,
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from "express";
import { ContextService } from './context.service';
import { CreatePageDto } from './dto/create-page.dto';
import { PageResponseDto } from './dto/page-response.dto';
import { PageListResponseDto } from './dto/page-list-response.dto';
import { PageSummaryDto } from './dto/page-summary.dto';
import { PageParamsDto } from './dto/page-params.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { AppendPageDto } from './dto/append-page.dto';
import { AddContextTagDto } from './dto/add-wiki-tag.dto';
import { CreateContextTagDto } from './dto/create-wiki-tag.dto';
import { ContextTagResponseDto } from './dto/wiki-tag-response.dto';
import { ListPagesQueryDto } from './dto/list-pages-query.dto';
import { PageTreeResponseDto } from './dto/page-tree-response.dto';
import { ReorderPageDto } from './dto/reorder-page.dto';
import { MovePageDto } from './dto/move-page.dto';
import { PageResult, PageSummaryResult, TagResult, PageTreeResult } from './dto/service/context.service.types';
import { ContextMcpGateway } from './context.mcp.gateway';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { UserContext } from '../auth/guards/context/auth-context.types';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';
import { ContextScopes } from './context.scopes';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';

@ApiTags('Context')
@ApiCookieAuth('JWT-Cookie')
@Controller('context/blocks')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(ContextScopes.READ.id)
export class ContextController {
  constructor(
    private readonly contextService: ContextService,
    private readonly gateway: ContextMcpGateway,
  ) {}

  @Post()
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new wiki page' })
  @ApiCreatedResponse({
    type: PageResponseDto,
    description: 'Context page created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createPage(
    @Body() dto: CreatePageDto,
    @CurrentUser() user: UserContext,
  ): Promise<PageResponseDto> {
    const result = await this.contextService.createPage({
      title: dto.title,
      content: dto.content,
      author: user.actorId,
      tagNames: dto.tagNames,
      parentId: dto.parentId,
    });

    return this.mapToResponse(result);
  }

  @Get()
  @ApiOperation({ summary: 'List wiki pages without content' })
  @ApiOkResponse({
    type: PageListResponseDto,
    description: 'List of wiki pages',
  })
  async listPages(@Query() query: ListPagesQueryDto): Promise<PageListResponseDto> {
    const items = await this.contextService.listPages({ tag: query.tag });
    return {
      items: items.map((item) => this.mapToSummary(item)),
    };
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get page hierarchy tree' })
  @ApiOkResponse({
    type: [PageTreeResponseDto],
    description: 'Page hierarchy tree',
  })
  async getPageTree(): Promise<PageTreeResponseDto[]> {
    const result = await this.contextService.getPageTree();
    return result.map((node) => this.mapToTreeResponse(node));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a wiki page by ID' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Context page retrieved successfully',
  })
  async getPage(@Param() params: PageParamsDto): Promise<PageResponseDto> {
    const result = await this.contextService.getPageById(params.id);
    return this.mapToResponse(result);
  }

  @Patch(':id')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Update an existing wiki page' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Context page updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'No update fields provided',
  })
  async updatePage(
    @Param() params: PageParamsDto,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: UserContext,
  ): Promise<PageResponseDto> {
    if (
      dto.title === undefined &&
      dto.content === undefined &&
      dto.author === undefined &&
      dto.tagNames === undefined &&
      dto.parentId === undefined &&
      dto.order === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const result = await this.contextService.updatePage(params.id, {
      title: dto.title,
      content: dto.content,
      author: user.actorId,
      tagNames: dto.tagNames,
      parentId: dto.parentId,
      order: dto.order,
    });

    return this.mapToResponse(result);
  }

  @Post(':id/append')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Append content to an existing wiki page' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Context page content appended successfully',
  })
  async appendToPage(
    @Param() params: PageParamsDto,
    @Body() dto: AppendPageDto,
  ): Promise<PageResponseDto> {
    const result = await this.contextService.appendToPage(params.id, {
      content: dto.content,
    });

    return this.mapToResponse(result);
  }

  @Patch(':id/reorder')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Reorder a page within siblings' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Page reordered successfully',
  })
  async reorderPage(
    @Param() params: PageParamsDto,
    @Body() dto: ReorderPageDto,
  ): Promise<PageResponseDto> {
    const result = await this.contextService.reorderPage(params.id, dto.newOrder);
    return this.mapToResponse(result);
  }

  @Patch(':id/move')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Move page to different parent' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Page moved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Circular reference detected or parent not found',
  })
  async movePage(
    @Param() params: PageParamsDto,
    @Body() dto: MovePageDto,
  ): Promise<PageResponseDto> {
    const result = await this.contextService.movePage(params.id, dto.newParentId);
    return this.mapToResponse(result);
  }

  @Delete(':id')
  @RequireScopes(ContextScopes.WRITE.id)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a wiki page' })
  @ApiNoContentResponse({ description: 'Context page deleted successfully' })
  async deletePage(@Param() params: PageParamsDto): Promise<void> {
    await this.contextService.deletePage(params.id);
  }

  @Post(':id/tags')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Add a tag to a wiki page' })
  @ApiCreatedResponse({
    type: PageResponseDto,
    description: 'Tag added to page successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addTagToPage(
    @Param() params: PageParamsDto,
    @Body() dto: AddContextTagDto,
  ): Promise<PageResponseDto> {
    const result = await this.contextService.addTagToPage(params.id, {
      name: dto.name,
      color: dto.color,
    });
    return this.mapToResponse(result);
  }

  @Delete(':id/tags/:tagId')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Remove a tag from a wiki page' })
  @ApiOkResponse({
    type: PageResponseDto,
    description: 'Tag removed from page successfully',
  })
  async removeTagFromPage(
    @Param('id') pageId: string,
    @Param('tagId') tagId: string,
  ): Promise<PageResponseDto> {
    const result = await this.contextService.removeTagFromPage(pageId, tagId);
    return this.mapToResponse(result);
  }

  @Post('tags')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiCreatedResponse({
    type: ContextTagResponseDto,
    description: 'Tag created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createTag(@Body() dto: CreateContextTagDto): Promise<ContextTagResponseDto> {
    const result = await this.contextService.createTag({
      name: dto.name,
    });
    return this.mapTagToResponse(result);
  }

  @Get('tags/all')
  @ApiOperation({ summary: 'Get all tags' })
  @ApiOkResponse({
    type: [ContextTagResponseDto],
    description: 'List of all tags',
  })
  async getAllTags(): Promise<ContextTagResponseDto[]> {
    const result = await this.contextService.getAllTags();
    return result.map((tag) => this.mapTagToResponse(tag));
  }

  @Delete('tags/:tagId')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Delete a tag from the system' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Tag deleted successfully' })
  async deleteTag(@Param('tagId') tagId: string): Promise<void> {
    await this.contextService.deleteTag(tagId);
  }

  private mapToResponse(result: PageResult): PageResponseDto {
    return {
      id: result.id,
      title: result.title,
      content: result.content,
      author: result.author,
      tags: result.tags.map((tag) => this.mapTagToResponse(tag)),
      parentId: result.parentId,
      order: result.order,
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
      parentId: result.parentId,
      order: result.order,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapTagToResponse(result: TagResult): ContextTagResponseDto {
    return {
      name: result.name,
      color: result.color,
    };
  }

  private mapToTreeResponse(result: PageTreeResult): PageTreeResponseDto {
    return {
      id: result.id,
      title: result.title,
      author: result.author,
      parentId: result.parentId,
      order: result.order,
      children: result.children.map((child) => this.mapToTreeResponse(child)),
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  @All('mcp')
  @RequireScopes(McpScopes .USE.id)
  async handleMcp(@Req() req: Request, @Res() res: Response) {
    await this.gateway.handleRequest(req, res);
  }
}
