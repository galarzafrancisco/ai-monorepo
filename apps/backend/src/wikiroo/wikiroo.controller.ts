import { Body, Controller, Get, Param, Post, All, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
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
import { PageResult, PageSummaryResult } from './dto/service/wikiroo.service.types';
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

  private mapToResponse(result: PageResult): PageResponseDto {
    return {
      id: result.id,
      title: result.title,
      content: result.content,
      author: result.author,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  private mapToSummary(result: PageSummaryResult): PageSummaryDto {
    return {
      id: result.id,
      title: result.title,
      author: result.author,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    };
  }

  @All('mcp')
  async handleMcp(@Req() req: Request, @Res() res: Response) {
    await this.gateway.handleRequest(req, res);
  }
}
