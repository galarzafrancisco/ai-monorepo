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
import type { Request, Response } from 'express';
import { ContextService } from './context.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { BlockResponseDto } from './dto/block-response.dto';
import { BlockListResponseDto } from './dto/block-list-response.dto';
import { BlockSummaryDto } from './dto/block-summary.dto';
import { BlockParamsDto } from './dto/block-params.dto';
import { UpdateBlockDto } from './dto/update-block.dto';
import { AppendBlockDto } from './dto/append-block.dto';
import { CreateTagDto } from '../meta/dto/create-tag.dto';
import { ContextTagResponseDto } from './dto/wiki-tag-response.dto';
import { ListBlocksQueryDto } from './dto/list-blocks-query.dto';
import { BlockTreeResponseDto } from './dto/block-tree-response.dto';
import { ReorderBlockDto } from './dto/reorder-block.dto';
import { MoveBlockDto } from './dto/move-block.dto';
import { SearchBlocksQueryDto } from './dto/search-blocks-query.dto';
import { BlockSearchResultDto } from './dto/block-search-result.dto';
import {
  BlockResult,
  BlockSummaryResult,
  TagResult,
  BlockTreeResult,
} from './dto/service/context.service.types';
import { ContextMcpGateway } from './context.mcp.gateway';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { CurrentUser } from '../auth/guards/decorators/current-user.decorator';
import type { AuthContext, UserContext } from '../auth/guards/context/auth-context.types';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';
import { ContextScopes } from './context.scopes';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { CurrentAuth } from 'src/auth/guards/decorators/current-auth.decorator';

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
    type: BlockResponseDto,
    description: 'Context page created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createBlock(
    @Body() dto: CreateBlockDto,
    @CurrentUser() user: UserContext,
  ): Promise<BlockResponseDto> {
    const result = await this.contextService.createBlock({
      title: dto.title,
      content: dto.content,
      createdByActorId: user.actorId,
      tagNames: dto.tagNames,
      parentId: dto.parentId,
    });

    return this.mapToResponse(result);
  }

  @Get()
  @ApiOperation({ summary: 'List wiki pages without content' })
  @ApiOkResponse({
    type: BlockListResponseDto,
    description: 'List of wiki pages',
  })
  async listBlocks(
    @Query() query: ListBlocksQueryDto,
  ): Promise<BlockListResponseDto> {
    const items = await this.contextService.listBlocks({ tag: query.tag });
    return {
      items: items.map((item) => this.mapToSummary(item)),
    };
  }

  @Get('search/query')
  @ApiOperation({ summary: 'Search blocks by query string' })
  @ApiOkResponse({
    type: [BlockSearchResultDto],
    description: 'Search results sorted by relevance',
  })
  async searchBlocks(
    @Query() query: SearchBlocksQueryDto,
  ): Promise<BlockSearchResultDto[]> {
    const results = await this.contextService.searchBlocks({
      query: query.query,
      limit: query.limit,
      threshold: query.threshold,
    });

    return results.map((result) => ({
      id: result.id,
      title: result.title,
      score: result.score,
    }));
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get page hierarchy tree' })
  @ApiOkResponse({
    type: [BlockTreeResponseDto],
    description: 'Page hierarchy tree',
  })
  async getBlockTree(): Promise<BlockTreeResponseDto[]> {
    const result = await this.contextService.getBlockTree();
    return result.map((node) => this.mapToTreeResponse(node));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch a wiki page by ID' })
  @ApiOkResponse({
    type: BlockResponseDto,
    description: 'Context page retrieved successfully',
  })
  async getBlock(@Param() params: BlockParamsDto): Promise<BlockResponseDto> {
    const result = await this.contextService.getBlockById(params.id);
    return this.mapToResponse(result);
  }

  @Patch(':id')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Update an existing wiki page' })
  @ApiOkResponse({
    type: BlockResponseDto,
    description: 'Context page updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'No update fields provided',
  })
  async updateBlock(
    @Param() params: BlockParamsDto,
    @Body() dto: UpdateBlockDto,
    @CurrentUser() user: UserContext,
  ): Promise<BlockResponseDto> {
    if (
      dto.title === undefined &&
      dto.content === undefined &&
      dto.tagNames === undefined &&
      dto.parentId === undefined &&
      dto.order === undefined
    ) {
      throw new BadRequestException('At least one field must be provided');
    }

    const result = await this.contextService.updateBlock(params.id, {
      title: dto.title,
      content: dto.content,
      tagNames: dto.tagNames,
      parentId: dto.parentId,
      order: dto.order,
      actorId: user.actorId,
    });

    return this.mapToResponse(result);
  }

  @Post(':id/append')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Append content to an existing wiki page' })
  @ApiOkResponse({
    type: BlockResponseDto,
    description: 'Context page content appended successfully',
  })
  async appendToBlock(
    @Param() params: BlockParamsDto,
    @Body() dto: AppendBlockDto,
    @CurrentUser() user: UserContext,
  ): Promise<BlockResponseDto> {
    const result = await this.contextService.appendToBlock(params.id, {
      content: dto.content,
      actorId: user.actorId,
    });

    return this.mapToResponse(result);
  }

  @Patch(':id/reorder')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Reorder a page within siblings' })
  @ApiOkResponse({
    type: BlockResponseDto,
    description: 'Page reordered successfully',
  })
  async reorderBlock(
    @Param() params: BlockParamsDto,
    @Body() dto: ReorderBlockDto,
  ): Promise<BlockResponseDto> {
    const result = await this.contextService.reorderBlock(
      params.id,
      dto.newOrder,
    );
    return this.mapToResponse(result);
  }

  @Patch(':id/move')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Move page to different parent' })
  @ApiOkResponse({
    type: BlockResponseDto,
    description: 'Page moved successfully',
  })
  @ApiBadRequestResponse({
    description: 'Circular reference detected or parent not found',
  })
  async moveBlock(
    @Param() params: BlockParamsDto,
    @Body() dto: MoveBlockDto,
  ): Promise<BlockResponseDto> {
    const result = await this.contextService.moveBlock(
      params.id,
      dto.newParentId,
    );
    return this.mapToResponse(result);
  }

  @Delete(':id')
  @RequireScopes(ContextScopes.WRITE.id)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a wiki page' })
  @ApiNoContentResponse({ description: 'Context page deleted successfully' })
  async deleteBlock(
    @Param() params: BlockParamsDto,
    @CurrentUser() user: UserContext,
  ): Promise<void> {
    await this.contextService.deleteBlock(params.id, user.actorId);
  }

  @Post(':id/tags')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Add a tag to a wiki page' })
  @ApiCreatedResponse({
    type: BlockResponseDto,
    description: 'Tag added to page successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async addTagToBlock(
    @Param() params: BlockParamsDto,
    @Body() dto: CreateTagDto,
    @CurrentUser() user: UserContext,
  ): Promise<BlockResponseDto> {
    const result = await this.contextService.addTagToBlock(
      params.id,
      {
        name: dto.name,
      },
      user.actorId,
    );
    return this.mapToResponse(result);
  }

  @Delete(':id/tags/:tagId')
  @RequireScopes(ContextScopes.WRITE.id)
  @ApiOperation({ summary: 'Remove a tag from a wiki page' })
  @ApiOkResponse({
    type: BlockResponseDto,
    description: 'Tag removed from page successfully',
  })
  async removeTagFromBlock(
    @Param('id') pageId: string,
    @Param('tagId') tagId: string,
    @CurrentUser() user: UserContext,
  ): Promise<BlockResponseDto> {
    const result = await this.contextService.removeTagFromBlock(
      pageId,
      tagId,
      user.actorId,
    );
    return this.mapToResponse(result);
  }

  private mapToResponse(result: BlockResult): BlockResponseDto {
    return {
      id: result.id,
      title: result.title,
      content: result.content,
      createdByActorId: result.createdByActorId,
      createdBy: result.createdBy,
      tags: result.tags.map((tag) => this.mapTagToResponse(tag)),
      parentId: result.parentId,
      order: result.order,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapToSummary(result: BlockSummaryResult): BlockSummaryDto {
    return {
      id: result.id,
      title: result.title,
      createdByActorId: result.createdByActorId,
      createdBy: result.createdBy,
      tags: result.tags.map((tag) => this.mapTagToResponse(tag)),
      parentId: result.parentId,
      order: result.order,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapTagToResponse(result: TagResult): ContextTagResponseDto {
    return {
      id: result.id,
      name: result.name,
      color: result.color,
    };
  }

  private mapToTreeResponse(result: BlockTreeResult): BlockTreeResponseDto {
    return {
      id: result.id,
      title: result.title,
      createdByActorId: result.createdByActorId,
      createdBy: result.createdBy,
      parentId: result.parentId,
      order: result.order,
      children: result.children.map((child) => this.mapToTreeResponse(child)),
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  @All('mcp')
  @RequireScopes(McpScopes.USE.id)
  async handleMcp(
    @CurrentUser() user: UserContext,
    @CurrentAuth() authContext: AuthContext,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.gateway.handleRequest(req, res, user, authContext);
  }
}
