import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
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
  ApiQuery,
  ApiProduces,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { PatchProjectDto } from './dto/patch-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
import { ImportProjectsResponseDto } from './dto/import-projects-response.dto';
import { ProjectResult } from './dto/service/projects.service.types';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { ScopesGuard } from '../auth/guards/guards/scopes.guard';
import { RequireScopes } from '../auth/guards/decorators/require-scopes.decorator';
import { MetaScopes } from './meta.scopes';

@ApiTags('Meta - Projects')
@ApiCookieAuth('JWT-Cookie')
@Controller('meta/projects')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(MetaScopes.READ.id)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @RequireScopes(MetaScopes.WRITE.id)
  @ApiOperation({ summary: 'Create a new project' })
  @ApiCreatedResponse({
    type: ProjectResponseDto,
    description: 'Project created successfully',
  })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async createProject(
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const result = await this.projectsService.createProject({
      slug: dto.slug,
      description: dto.description,
      repoUrl: dto.repoUrl,
      color: dto.color,
    });
    return this.mapProjectResultToResponse(result);
  }

  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  @ApiOkResponse({
    type: [ProjectResponseDto],
    description: 'List of all projects',
  })
  async getAllProjects(): Promise<ProjectResponseDto[]> {
    const result = await this.projectsService.getAllProjects();
    return result.map((project) => this.mapProjectResultToResponse(project));
  }

  @Get('export')
  @ApiOperation({ summary: 'Export all projects as JSON' })
  @ApiProduces('application/json')
  @ApiOkResponse({
    description: 'Projects JSON downloaded successfully',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  async exportProjects(
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.projectsService.exportProjectsAsJson();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `projects-${timestamp}.json`;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', file.byteLength.toString());

    return new StreamableFile(file);
  }

  @Post('import')
  @RequireScopes(MetaScopes.WRITE.id)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import projects from JSON' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'JSON file exported from projects',
        },
      },
    },
  })
  @ApiCreatedResponse({
    type: ImportProjectsResponseDto,
    description: 'Projects imported successfully',
  })
  @ApiBadRequestResponse({
    description: 'No JSON file uploaded or invalid file type',
  })
  async importProjects(
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
        }
      | undefined,
  ): Promise<ImportProjectsResponseDto> {
    if (!file) {
      throw new BadRequestException('A JSON file is required');
    }

    const lowerName = file.originalname.toLowerCase();
    const isJsonMime =
      file.mimetype === 'application/json' || file.mimetype === 'text/json';
    if (!lowerName.endsWith('.json') && !isJsonMime) {
      throw new BadRequestException('Only .json files are supported');
    }

    return this.projectsService.importProjectsFromJson(file.buffer);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search projects by name and description' })
  @ApiQuery({
    name: 'q',
    required: true,
    description: 'Search query',
    example: 'taico',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of results',
    example: 10,
  })
  @ApiQuery({
    name: 'threshold',
    required: false,
    description: 'Match threshold (0-1)',
    example: 0.3,
  })
  @ApiOkResponse({
    type: [ProjectResponseDto],
    description: 'List of matching projects',
  })
  async searchProjects(
    @Query('q') query: string,
    @Query('limit') limit?: number,
    @Query('threshold') threshold?: number,
  ): Promise<ProjectResponseDto[]> {
    const result = await this.projectsService.searchProjects({
      query,
      limit: limit ? parseInt(String(limit), 10) : undefined,
      threshold: threshold ? parseFloat(String(threshold)) : undefined,
    });
    return result.map((project) => this.mapProjectResultToResponse(project));
  }

  @Get('by-slug/:slug')
  @ApiOperation({ summary: 'Get project by slug' })
  @ApiOkResponse({
    type: ProjectResponseDto,
    description: 'Project found',
  })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async getProjectBySlug(
    @Param('slug') slug: string,
  ): Promise<ProjectResponseDto> {
    const result = await this.projectsService.getProjectBySlug(slug);
    if (!result) {
      throw new NotFoundException(`Project with slug ${slug} not found`);
    }
    return this.mapProjectResultToResponse(result);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project by ID' })
  @ApiOkResponse({
    type: ProjectResponseDto,
    description: 'Project found',
  })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async getProject(
    @Param('projectId') projectId: string,
  ): Promise<ProjectResponseDto> {
    const result = await this.projectsService.getProjectById(projectId);
    return this.mapProjectResultToResponse(result);
  }

  @Patch(':projectId')
  @RequireScopes(MetaScopes.WRITE.id)
  @ApiOperation({ summary: 'Update project (partial update)' })
  @ApiOkResponse({
    type: ProjectResponseDto,
    description: 'Project updated successfully',
  })
  @ApiNotFoundResponse({ description: 'Project not found' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async updateProject(
    @Param('projectId') projectId: string,
    @Body() dto: PatchProjectDto,
  ): Promise<ProjectResponseDto> {
    const result = await this.projectsService.updateProject(projectId, {
      description: dto.description,
      repoUrl: dto.repoUrl,
    });
    return this.mapProjectResultToResponse(result);
  }

  @Delete(':projectId')
  @RequireScopes(MetaScopes.WRITE.id)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiNoContentResponse({ description: 'Project deleted successfully' })
  @ApiNotFoundResponse({ description: 'Project not found' })
  async deleteProject(@Param('projectId') projectId: string): Promise<void> {
    await this.projectsService.deleteProject(projectId);
  }

  private mapProjectResultToResponse(
    result: ProjectResult,
  ): ProjectResponseDto {
    return {
      id: result.id,
      tagId: result.tagId,
      tagName: result.tagName,
      tagColor: result.tagColor,
      slug: result.slug,
      description: result.description,
      repoUrl: result.repoUrl,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }
}
