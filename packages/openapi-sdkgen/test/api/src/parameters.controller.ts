import { Controller, Get, Post, Delete, Head, Options, Param, Query, Headers, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiHeader, ApiProperty, ApiCookieAuth } from '@nestjs/swagger';
import { Request } from 'express';

export class PathParamsResponseDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  message: string;
}

export class MultiplePathParamsResponseDto {
  @ApiProperty({ type: String })
  orgId: string;

  @ApiProperty({ type: String })
  projectId: string;

  @ApiProperty({ type: String })
  taskId: string;

  @ApiProperty({ type: String })
  message: string;
}

export class QueryParamsResponseDto {
  @ApiProperty({ type: String, required: false })
  requiredParam?: string;

  @ApiProperty({ type: String, required: false })
  optionalParam?: string;

  @ApiProperty({ type: String, required: false })
  defaultedParam?: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  nullableParam?: string | null;

  @ApiProperty({ type: Boolean, required: false })
  boolParam?: boolean;

  @ApiProperty({ type: Number, required: false })
  numberParam?: number;

  @ApiProperty({ type: Number, required: false })
  integerParam?: number;

  @ApiProperty({ type: String, required: false })
  stringParam?: string;
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class EnumQueryResponseDto {
  @ApiProperty({ enum: SortOrder })
  sortOrder: SortOrder;

  @ApiProperty({ type: String })
  message: string;
}

export class ArrayQueryResponseDto {
  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: [Number] })
  ids: number[];

  @ApiProperty({ type: String })
  message: string;
}

export class PaginationQueryResponseDto {
  @ApiProperty({ type: Number })
  page: number;

  @ApiProperty({ type: Number })
  limit: number;

  @ApiProperty({ type: String, required: false })
  cursor?: string;

  @ApiProperty({ type: String })
  message: string;
}

export class SortingQueryResponseDto {
  @ApiProperty({ type: String })
  sortBy: string;

  @ApiProperty({ enum: SortOrder })
  sortOrder: SortOrder;

  @ApiProperty({ type: String })
  message: string;
}

export class FilteringQueryResponseDto {
  @ApiProperty({ type: String, required: false })
  status?: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiProperty({ type: String, required: false })
  createdAfter?: string;

  @ApiProperty({ type: String })
  message: string;
}

export class SearchQueryResponseDto {
  @ApiProperty({ type: String })
  q: string;

  @ApiProperty({ type: String })
  message: string;
}

export class DateTimeQueryResponseDto {
  @ApiProperty({ type: String, format: 'date' })
  date: string;

  @ApiProperty({ type: String, format: 'date-time' })
  datetime: string;

  @ApiProperty({ type: String })
  message: string;
}

export class HeaderParamsResponseDto {
  @ApiProperty({ type: String })
  requestId: string;

  @ApiProperty({ type: String })
  apiVersion: string;

  @ApiProperty({ type: String, required: false })
  locale?: string;

  @ApiProperty({ type: String })
  message: string;
}

export class MixedParamsResponseDto {
  @ApiProperty({ type: String })
  pathId: string;

  @ApiProperty({ type: String })
  queryParam: string;

  @ApiProperty({ type: String })
  headerValue: string;
}

export class CookieParamsResponseDto {
  @ApiProperty({ type: String, required: false })
  sessionId?: string;

  @ApiProperty({ type: String, required: false })
  userId?: string;

  @ApiProperty({ type: String })
  message: string;
}

export class DeleteConfirmationDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: Boolean })
  deleted: boolean;

  @ApiProperty({ type: String })
  message: string;
}

@ApiTags('parameters')
@Controller('parameters')
export class ParametersController {
  // Path parameters
  @Get('path/:id')
  @ApiOperation({ summary: 'Test single path parameter' })
  @ApiResponse({ status: 200, type: PathParamsResponseDto })
  singlePathParam(@Param('id') id: string): PathParamsResponseDto {
    return { id, message: 'Single path param' };
  }

  @Get('path/:id1/:id2')
  @ApiOperation({ summary: 'Test multiple path parameters' })
  @ApiResponse({ status: 200, type: PathParamsResponseDto })
  multiplePathParams(
    @Param('id1') id1: string,
    @Param('id2') id2: string,
  ): PathParamsResponseDto {
    return { id: `${id1}-${id2}`, message: 'Multiple path params' };
  }

  @Get('nested/orgs/:orgId/projects/:projectId/tasks/:taskId')
  @ApiOperation({ summary: 'Test deeply nested resource paths' })
  @ApiResponse({ status: 200, type: MultiplePathParamsResponseDto })
  deeplyNestedPath(
    @Param('orgId') orgId: string,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ): MultiplePathParamsResponseDto {
    return {
      orgId,
      projectId,
      taskId,
      message: 'Deeply nested resource path',
    };
  }

  // Query parameters
  @Get('query/all-types')
  @ApiOperation({ summary: 'Test all query parameter types' })
  @ApiQuery({ name: 'requiredParam', required: true, type: String })
  @ApiQuery({ name: 'optionalParam', required: false, type: String })
  @ApiQuery({ name: 'defaultedParam', required: false, type: String, schema: { default: 'default' } })
  @ApiQuery({ name: 'nullableParam', required: false, type: String, allowEmptyValue: true })
  @ApiQuery({ name: 'boolParam', required: false, type: Boolean })
  @ApiQuery({ name: 'numberParam', required: false, type: Number })
  @ApiQuery({ name: 'integerParam', required: false, type: Number })
  @ApiQuery({ name: 'stringParam', required: false, type: String })
  @ApiResponse({ status: 200, type: QueryParamsResponseDto })
  allQueryTypes(
    @Query('requiredParam') requiredParam: string,
    @Query('optionalParam') optionalParam?: string,
    @Query('defaultedParam') defaultedParam: string = 'default',
    @Query('nullableParam') nullableParam?: string | null,
    @Query('boolParam') boolParam?: boolean,
    @Query('numberParam') numberParam?: number,
    @Query('integerParam') integerParam?: number,
    @Query('stringParam') stringParam?: string,
  ): QueryParamsResponseDto {
    return {
      requiredParam,
      optionalParam,
      defaultedParam,
      nullableParam,
      boolParam,
      numberParam,
      integerParam,
      stringParam,
    };
  }

  @Get('query/enum')
  @ApiOperation({ summary: 'Test enum query parameter' })
  @ApiQuery({ name: 'sortOrder', required: true, enum: SortOrder })
  @ApiResponse({ status: 200, type: EnumQueryResponseDto })
  enumQuery(@Query('sortOrder') sortOrder: SortOrder): EnumQueryResponseDto {
    return {
      sortOrder,
      message: 'Enum query param',
    };
  }

  @Get('query/arrays')
  @ApiOperation({ summary: 'Test array query parameters' })
  @ApiQuery({ name: 'tags', required: true, type: String, isArray: true })
  @ApiQuery({ name: 'ids', required: true, type: Number, isArray: true })
  @ApiResponse({ status: 200, type: ArrayQueryResponseDto })
  arrayQuery(
    @Query('tags') tags: string[],
    @Query('ids') ids: number[],
  ): ArrayQueryResponseDto {
    return {
      tags: Array.isArray(tags) ? tags : [tags],
      ids: Array.isArray(ids) ? ids : [ids],
      message: 'Array query params',
    };
  }

  @Get('query/pagination')
  @ApiOperation({ summary: 'Test pagination query parameters' })
  @ApiQuery({ name: 'page', required: false, type: Number, schema: { default: 1 } })
  @ApiQuery({ name: 'limit', required: false, type: Number, schema: { default: 10 } })
  @ApiQuery({ name: 'cursor', required: false, type: String })
  @ApiResponse({ status: 200, type: PaginationQueryResponseDto })
  paginationQuery(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('cursor') cursor?: string,
  ): PaginationQueryResponseDto {
    return {
      page: Number(page),
      limit: Number(limit),
      cursor,
      message: 'Pagination params',
    };
  }

  @Get('query/sorting')
  @ApiOperation({ summary: 'Test sorting query parameters' })
  @ApiQuery({ name: 'sortBy', required: true, type: String })
  @ApiQuery({ name: 'sortOrder', required: true, enum: SortOrder })
  @ApiResponse({ status: 200, type: SortingQueryResponseDto })
  sortingQuery(
    @Query('sortBy') sortBy: string,
    @Query('sortOrder') sortOrder: SortOrder,
  ): SortingQueryResponseDto {
    return {
      sortBy,
      sortOrder,
      message: 'Sorting params',
    };
  }

  @Get('query/filtering')
  @ApiOperation({ summary: 'Test filtering query parameters' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'tags', required: false, type: String, isArray: true })
  @ApiQuery({ name: 'createdAfter', required: false, type: String, format: 'date-time' })
  @ApiResponse({ status: 200, type: FilteringQueryResponseDto })
  filteringQuery(
    @Query('status') status?: string,
    @Query('tags') tags?: string[],
    @Query('createdAfter') createdAfter?: string,
  ): FilteringQueryResponseDto {
    return {
      status,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
      createdAfter,
      message: 'Filtering params',
    };
  }

  @Get('query/search')
  @ApiOperation({ summary: 'Test search query parameter' })
  @ApiQuery({ name: 'q', required: true, type: String })
  @ApiResponse({ status: 200, type: SearchQueryResponseDto })
  searchQuery(@Query('q') q: string): SearchQueryResponseDto {
    return {
      q,
      message: 'Search param',
    };
  }

  @Get('query/datetime')
  @ApiOperation({ summary: 'Test date/datetime query parameters' })
  @ApiQuery({ name: 'date', required: true, type: String, format: 'date' })
  @ApiQuery({ name: 'datetime', required: true, type: String, format: 'date-time' })
  @ApiResponse({ status: 200, type: DateTimeQueryResponseDto })
  dateTimeQuery(
    @Query('date') date: string,
    @Query('datetime') datetime: string,
  ): DateTimeQueryResponseDto {
    return {
      date,
      datetime,
      message: 'Date/datetime params',
    };
  }

  // Header parameters
  @Get('headers/custom')
  @ApiOperation({ summary: 'Test custom header parameters' })
  @ApiHeader({ name: 'x-request-id', required: true })
  @ApiHeader({ name: 'x-api-version', required: true })
  @ApiHeader({ name: 'accept-language', required: false })
  @ApiResponse({ status: 200, type: HeaderParamsResponseDto })
  headerParams(
    @Headers('x-request-id') requestId: string,
    @Headers('x-api-version') apiVersion: string,
    @Headers('accept-language') locale?: string,
  ): HeaderParamsResponseDto {
    return {
      requestId,
      apiVersion,
      locale,
      message: 'Custom header params',
    };
  }

  // Mixed parameters
  @Get('mixed/:pathId')
  @ApiOperation({ summary: 'Test mixed path, query, and header parameters' })
  @ApiQuery({ name: 'queryParam', required: true, type: String })
  @ApiHeader({ name: 'x-custom-header', required: true })
  @ApiResponse({ status: 200, type: MixedParamsResponseDto })
  mixedParams(
    @Param('pathId') pathId: string,
    @Query('queryParam') queryParam: string,
    @Headers('x-custom-header') headerValue: string,
  ): MixedParamsResponseDto {
    return {
      pathId,
      queryParam,
      headerValue,
    };
  }

  // No parameters
  @Get('no-params')
  @ApiOperation({ summary: 'Test endpoint with no parameters' })
  @ApiResponse({ status: 200, type: PathParamsResponseDto })
  noParams(): PathParamsResponseDto {
    return {
      id: 'none',
      message: 'No parameters',
    };
  }

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Test DELETE with path parameter returning 204' })
  @ApiResponse({ status: 204, description: 'Resource deleted' })
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWithParam(@Param('id') id: string): void {
    // No content response
  }

  @Delete('delete-confirmed/:id')
  @ApiOperation({ summary: 'Test DELETE returning JSON confirmation body' })
  @ApiResponse({ status: 200, description: 'Resource deleted with confirmation', type: DeleteConfirmationDto })
  deleteWithConfirmation(@Param('id') id: string): DeleteConfirmationDto {
    return {
      id,
      deleted: true,
      message: `Resource ${id} has been deleted`,
    };
  }

  // Cookie parameters
  @Get('cookies')
  @ApiOperation({ summary: 'Test cookie parameters' })
  @ApiCookieAuth()
  @ApiResponse({ status: 200, type: CookieParamsResponseDto })
  cookieParams(@Req() req: Request): CookieParamsResponseDto {
    const sessionId = req.cookies?.sessionId;
    const userId = req.cookies?.userId;
    return {
      sessionId,
      userId,
      message: 'Cookie parameters',
    };
  }

  // HEAD endpoint
  @Head('head-check')
  @ApiOperation({ summary: 'Test HEAD method' })
  @ApiResponse({ status: 200, description: 'Headers only, no body' })
  headCheck(): void {
    // HEAD returns headers only, no body
  }

  // OPTIONS endpoint
  @Options('options-check')
  @ApiOperation({ summary: 'Test OPTIONS method' })
  @ApiResponse({ status: 200, description: 'CORS preflight or available methods' })
  optionsCheck(): { methods: string[] } {
    return {
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
    };
  }
}
