import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AgentImportExportService } from './agent-import-export.service';
import {
  AgentDefinitionsDocumentDto,
  ImportAgentsResponseDto,
} from './dto/agent-definition.dto';
import { ExportAgentsQueryDto } from './dto/export-agents-query.dto';
import { AccessTokenGuard } from '../auth/guards/guards/access-token.guard';
import { RequireScopes } from 'src/auth/guards/decorators/require-scopes.decorator';
import { AgentsScopes } from './agents.scopes';
import { ScopesGuard } from 'src/auth/guards/guards/scopes.guard';

// Lives outside `/agents` because a fixed path there would shadow `GET /agents/:slug`.
@ApiTags('Agent')
@ApiCookieAuth('JWT-Cookie')
@Controller('agent-definitions')
@UseGuards(AccessTokenGuard, ScopesGuard)
@RequireScopes(AgentsScopes.READ.id)
export class AgentDefinitionsController {
  constructor(
    private readonly agentImportExportService: AgentImportExportService,
  ) {}

  @Get('export')
  @ApiOperation({
    summary: 'Export agent definitions as portable JSON',
  })
  @ApiOkResponse({ type: AgentDefinitionsDocumentDto })
  async exportAgents(
    @Query() query: ExportAgentsQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AgentDefinitionsDocumentDto> {
    const document = await this.agentImportExportService.exportAgents(
      query.slug,
    );
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="agents-${timestamp}.json"`,
    );
    return AgentDefinitionsDocumentDto.fromDocument(document);
  }

  @Post('import')
  @RequireScopes(AgentsScopes.WRITE.id)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Import agent definitions, creating or updating by slug',
  })
  @ApiOkResponse({ type: ImportAgentsResponseDto })
  async importAgents(
    @Body() dto: AgentDefinitionsDocumentDto,
  ): Promise<ImportAgentsResponseDto> {
    const result = await this.agentImportExportService.importAgents({
      version: dto.version,
      agents: dto.agents,
    });
    return ImportAgentsResponseDto.fromResult(result);
  }
}
