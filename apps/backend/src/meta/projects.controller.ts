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
} from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { PatchProjectDto } from './dto/patch-project.dto';
import { ProjectResponseDto } from './dto/project-response.dto';
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

  private mapProjectResultToResponse(result: ProjectResult): ProjectResponseDto {
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
