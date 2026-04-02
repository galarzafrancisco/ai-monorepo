import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiProperty } from '@nestjs/swagger';

// Item DTO used in paginated responses
export class PaginatedItemDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  description: string;
}

// Offset-based pagination
export class OffsetPaginatedResponseDto {
  @ApiProperty({ type: [PaginatedItemDto] })
  items: PaginatedItemDto[];

  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty({ type: Number })
  offset: number;

  @ApiProperty({ type: Number })
  limit: number;
}

// Page-based pagination
export class PagePaginatedResponseDto {
  @ApiProperty({ type: [PaginatedItemDto] })
  items: PaginatedItemDto[];

  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty({ type: Number })
  page: number;

  @ApiProperty({ type: Number })
  pageSize: number;

  @ApiProperty({ type: Number })
  totalPages: number;

  @ApiProperty({ type: Boolean })
  hasNextPage: boolean;

  @ApiProperty({ type: Boolean })
  hasPreviousPage: boolean;
}

// Cursor-based pagination
export class CursorPaginatedResponseDto {
  @ApiProperty({ type: [PaginatedItemDto] })
  items: PaginatedItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor: string | null;

  @ApiProperty({ type: String, nullable: true })
  previousCursor: string | null;

  @ApiProperty({ type: Boolean })
  hasMore: boolean;
}

// Token-based pagination (like nextToken)
export class TokenPaginatedResponseDto {
  @ApiProperty({ type: [PaginatedItemDto] })
  data: PaginatedItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextToken: string | null;
}

// Link-based pagination metadata
export class PaginationLinksDto {
  @ApiProperty({ type: String, nullable: true })
  first: string | null;

  @ApiProperty({ type: String, nullable: true })
  previous: string | null;

  @ApiProperty({ type: String, nullable: true })
  next: string | null;

  @ApiProperty({ type: String, nullable: true })
  last: string | null;
}

export class LinkPaginatedResponseDto {
  @ApiProperty({ type: [PaginatedItemDto] })
  items: PaginatedItemDto[];

  @ApiProperty({ type: () => PaginationLinksDto })
  links: PaginationLinksDto;

  @ApiProperty({ type: Number })
  total: number;
}

// Combined metadata pagination
export class PaginationMetadataDto {
  @ApiProperty({ type: Number })
  total: number;

  @ApiProperty({ type: Number })
  page: number;

  @ApiProperty({ type: Number })
  pageSize: number;

  @ApiProperty({ type: Number })
  totalPages: number;
}

export class MetadataPaginatedResponseDto {
  @ApiProperty({ type: [PaginatedItemDto] })
  data: PaginatedItemDto[];

  @ApiProperty({ type: () => PaginationMetadataDto })
  pagination: PaginationMetadataDto;
}

@ApiTags('pagination')
@Controller('pagination')
export class PaginationController {
  private mockItems: PaginatedItemDto[] = Array.from({ length: 100 }, (_, i) => ({
    id: String(i + 1),
    name: `Item ${i + 1}`,
    description: `Description for item ${i + 1}`,
  }));

  @Get('offset')
  @ApiOperation({ summary: 'Offset-based pagination' })
  @ApiQuery({ name: 'offset', required: false, type: Number, schema: { default: 0 } })
  @ApiQuery({ name: 'limit', required: false, type: Number, schema: { default: 10 } })
  @ApiResponse({ status: 200, type: OffsetPaginatedResponseDto })
  offsetPagination(
    @Query('offset') offset: number = 0,
    @Query('limit') limit: number = 10,
  ): OffsetPaginatedResponseDto {
    const start = Number(offset);
    const end = start + Number(limit);
    const items = this.mockItems.slice(start, end);

    return {
      items,
      total: this.mockItems.length,
      offset: start,
      limit: Number(limit),
    };
  }

  @Get('page')
  @ApiOperation({ summary: 'Page-based pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, schema: { default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, schema: { default: 10 } })
  @ApiResponse({ status: 200, type: PagePaginatedResponseDto })
  pagePagination(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ): PagePaginatedResponseDto {
    const pageNum = Number(page);
    const size = Number(pageSize);
    const start = (pageNum - 1) * size;
    const end = start + size;
    const items = this.mockItems.slice(start, end);
    const totalPages = Math.ceil(this.mockItems.length / size);

    return {
      items,
      total: this.mockItems.length,
      page: pageNum,
      pageSize: size,
      totalPages,
      hasNextPage: pageNum < totalPages,
      hasPreviousPage: pageNum > 1,
    };
  }

  @Get('cursor')
  @ApiOperation({ summary: 'Cursor-based pagination' })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, schema: { default: 10 } })
  @ApiResponse({ status: 200, type: CursorPaginatedResponseDto })
  cursorPagination(
    @Query('cursor') cursor?: string,
    @Query('limit') limit: number = 10,
  ): CursorPaginatedResponseDto {
    // Decode cursor (in real implementation, this would be encrypted/encoded)
    const startIndex = cursor ? parseInt(cursor, 10) : 0;
    const size = Number(limit);
    const end = startIndex + size;
    const items = this.mockItems.slice(startIndex, end);

    const hasMore = end < this.mockItems.length;
    const nextCursor = hasMore ? String(end) : null;
    const previousCursor = startIndex > 0 ? String(Math.max(0, startIndex - size)) : null;

    return {
      items,
      nextCursor,
      previousCursor,
      hasMore,
    };
  }

  @Get('token')
  @ApiOperation({ summary: 'NextToken-based pagination' })
  @ApiQuery({ name: 'nextToken', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, schema: { default: 10 } })
  @ApiResponse({ status: 200, type: TokenPaginatedResponseDto })
  tokenPagination(
    @Query('nextToken') nextToken?: string,
    @Query('limit') limit: number = 10,
  ): TokenPaginatedResponseDto {
    const startIndex = nextToken ? parseInt(nextToken, 10) : 0;
    const size = Number(limit);
    const end = startIndex + size;
    const data = this.mockItems.slice(startIndex, end);

    const hasMore = end < this.mockItems.length;
    const nextTokenValue = hasMore ? String(end) : null;

    return {
      data,
      nextToken: nextTokenValue,
    };
  }

  @Get('links')
  @ApiOperation({ summary: 'Link-based pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, schema: { default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, schema: { default: 10 } })
  @ApiResponse({ status: 200, type: LinkPaginatedResponseDto })
  linkPagination(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ): LinkPaginatedResponseDto {
    const pageNum = Number(page);
    const size = Number(pageSize);
    const start = (pageNum - 1) * size;
    const end = start + size;
    const items = this.mockItems.slice(start, end);
    const totalPages = Math.ceil(this.mockItems.length / size);

    const baseUrl = '/pagination/links';
    const links: PaginationLinksDto = {
      first: `${baseUrl}?page=1&pageSize=${size}`,
      previous: pageNum > 1 ? `${baseUrl}?page=${pageNum - 1}&pageSize=${size}` : null,
      next: pageNum < totalPages ? `${baseUrl}?page=${pageNum + 1}&pageSize=${size}` : null,
      last: `${baseUrl}?page=${totalPages}&pageSize=${size}`,
    };

    return {
      items,
      links,
      total: this.mockItems.length,
    };
  }

  @Get('metadata')
  @ApiOperation({ summary: 'Pagination with metadata object' })
  @ApiQuery({ name: 'page', required: false, type: Number, schema: { default: 1 } })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, schema: { default: 10 } })
  @ApiResponse({ status: 200, type: MetadataPaginatedResponseDto })
  metadataPagination(
    @Query('page') page: number = 1,
    @Query('pageSize') pageSize: number = 10,
  ): MetadataPaginatedResponseDto {
    const pageNum = Number(page);
    const size = Number(pageSize);
    const start = (pageNum - 1) * size;
    const end = start + size;
    const data = this.mockItems.slice(start, end);
    const totalPages = Math.ceil(this.mockItems.length / size);

    return {
      data,
      pagination: {
        total: this.mockItems.length,
        page: pageNum,
        pageSize: size,
        totalPages,
      },
    };
  }
}
