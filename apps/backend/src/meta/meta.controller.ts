import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { MetaService, TAG_COLOR_PALETTE } from './meta.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { MetaTagResponseDto } from './dto/tag-response.dto';
import { TagResult } from './dto/service/meta.service.types';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { MetaScopes } from './meta.scopes';

@ApiTags('Meta')
@ApiCookieAuth('JWT-Cookie')
@Controller('meta')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(MetaScopes.READ.id)
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Post('tags')
  @RequireScopes(MetaScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new tag' })
  @ApiCreatedResponse({
    type: MetaTagResponseDto,
    description: 'Tag created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createTag(@Body() dto: CreateTagDto): Promise<MetaTagResponseDto> {
    const result = await this.metaService.createTag({
      name: dto.name,
    });
    return this.mapTagResultToResponse(result);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get all tags' })
  @ApiOkResponse({
    type: [MetaTagResponseDto],
    description: 'List of all tags',
  })
  async getAllTags(): Promise<MetaTagResponseDto[]> {
    const result = await this.metaService.getAllTags();
    return result.map((tag) => this.mapTagResultToResponse(tag));
  }

  @Get('tags/colors')
  @ApiOperation({ summary: 'Get available tag colors' })
  @ApiOkResponse({
    type: [String],
    description: 'List of available tag colors in hex format',
  })
  getTagColors(): string[] {
    return [...TAG_COLOR_PALETTE];
  }

  @Delete('tags/:tagId')
  @RequireScopes(MetaScopes.WRITE.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a tag from the system' })
  @ApiNoContentResponse({ description: 'Tag deleted successfully' })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  async deleteTag(@Param('tagId') tagId: string): Promise<void> {
    await this.metaService.deleteTag(tagId);
  }

  private mapTagResultToResponse(result: TagResult): MetaTagResponseDto {
    return {
      id: result.id,
      name: result.name,
      color: result.color,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
