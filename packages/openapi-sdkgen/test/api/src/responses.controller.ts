import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiProperty, ApiProduces } from '@nestjs/swagger';

export class SuccessResponseDto {
  @ApiProperty({ type: String })
  message: string;

  @ApiProperty({ type: String })
  data: string;
}

export class CreatedResourceDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  createdAt: string;
}

export class AcceptedOperationDto {
  @ApiProperty({ type: String })
  operationId: string;

  @ApiProperty({ type: String })
  status: string;

  @ApiProperty({ type: String })
  message: string;
}

export class ValidationErrorDto {
  @ApiProperty({ type: String })
  error: string;

  @ApiProperty({ type: [String] })
  validationErrors: string[];
}

export class ErrorResponseDto {
  @ApiProperty({ type: String })
  error: string;

  @ApiProperty({ type: String })
  message: string;

  @ApiProperty({ type: Number })
  statusCode: number;
}

export class ProblemDetailsDto {
  @ApiProperty({ type: String })
  type: string;

  @ApiProperty({ type: String })
  title: string;

  @ApiProperty({ type: Number })
  status: number;

  @ApiProperty({ type: String })
  detail: string;

  @ApiProperty({ type: String })
  instance: string;
}

export class ConflictErrorDto {
  @ApiProperty({ type: String })
  error: string;

  @ApiProperty({ type: String })
  conflictingResource: string;
}

export class RateLimitErrorDto {
  @ApiProperty({ type: String })
  error: string;

  @ApiProperty({ type: Number })
  retryAfter: number;
}

export class JsonObjectResponseDto {
  @ApiProperty({ type: String })
  key: string;

  @ApiProperty({ type: String })
  value: string;
}

export class JsonArrayItemDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;
}

export class MultipleStatusDto {
  @ApiProperty({ type: String })
  result: string;
}

export class ResponseWithHeadersDto {
  @ApiProperty({ type: String })
  message: string;
}

@ApiTags('responses')
@Controller('responses')
export class ResponsesController {
  // Success responses
  @Get('200-ok')
  @ApiOperation({ summary: 'Test 200 OK response' })
  @ApiResponse({ status: 200, description: 'Success', type: SuccessResponseDto })
  @HttpCode(HttpStatus.OK)
  response200(): SuccessResponseDto {
    return {
      message: 'OK',
      data: 'Success response',
    };
  }

  @Post('201-created')
  @ApiOperation({ summary: 'Test 201 Created response' })
  @ApiResponse({ status: 201, description: 'Resource created', type: CreatedResourceDto })
  @HttpCode(HttpStatus.CREATED)
  response201(): CreatedResourceDto {
    return {
      id: '12345',
      name: 'New Resource',
      createdAt: new Date().toISOString(),
    };
  }

  @Post('202-accepted')
  @ApiOperation({ summary: 'Test 202 Accepted response' })
  @ApiResponse({ status: 202, description: 'Operation accepted', type: AcceptedOperationDto })
  @HttpCode(HttpStatus.ACCEPTED)
  response202(): AcceptedOperationDto {
    return {
      operationId: 'op-789',
      status: 'pending',
      message: 'Operation accepted for processing',
    };
  }

  @Get('204-no-content')
  @ApiOperation({ summary: 'Test 204 No Content response' })
  @ApiResponse({ status: 204, description: 'No content' })
  @HttpCode(HttpStatus.NO_CONTENT)
  response204(): void {
    // No content
  }

  // Error responses
  @Get('400-bad-request')
  @ApiOperation({ summary: 'Test 400 Bad Request response' })
  @ApiResponse({ status: 400, description: 'Bad request', type: ValidationErrorDto })
  response400(): void {
    throw new BadRequestException({
      error: 'Bad Request',
      validationErrors: ['Field is required', 'Invalid email format'],
    });
  }

  @Get('401-unauthorized')
  @ApiOperation({ summary: 'Test 401 Unauthorized response' })
  @ApiResponse({ status: 401, description: 'Unauthorized', type: ErrorResponseDto })
  response401(): void {
    throw new UnauthorizedException({
      error: 'Unauthorized',
      message: 'Authentication required',
      statusCode: 401,
    });
  }

  @Get('403-forbidden')
  @ApiOperation({ summary: 'Test 403 Forbidden response' })
  @ApiResponse({ status: 403, description: 'Forbidden', type: ErrorResponseDto })
  response403(): void {
    throw new ForbiddenException({
      error: 'Forbidden',
      message: 'Insufficient permissions',
      statusCode: 403,
    });
  }

  @Get('404-not-found')
  @ApiOperation({ summary: 'Test 404 Not Found response' })
  @ApiResponse({ status: 404, description: 'Not found', type: ErrorResponseDto })
  response404(): void {
    throw new NotFoundException({
      error: 'Not Found',
      message: 'Resource not found',
      statusCode: 404,
    });
  }

  @Post('409-conflict')
  @ApiOperation({ summary: 'Test 409 Conflict response' })
  @ApiResponse({ status: 409, description: 'Conflict', type: ConflictErrorDto })
  response409(): void {
    throw new ConflictException({
      error: 'Conflict',
      conflictingResource: 'Resource with same name already exists',
    });
  }

  @Get('422-unprocessable-entity')
  @ApiOperation({ summary: 'Test 422 Unprocessable Entity response' })
  @ApiResponse({ status: 422, description: 'Unprocessable entity', type: ValidationErrorDto })
  @HttpCode(HttpStatus.UNPROCESSABLE_ENTITY)
  response422(): ValidationErrorDto {
    return {
      error: 'Unprocessable Entity',
      validationErrors: ['Business rule violation', 'Invalid state transition'],
    };
  }

  @Get('429-rate-limit')
  @ApiOperation({ summary: 'Test 429 Too Many Requests response' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded', type: RateLimitErrorDto })
  @HttpCode(HttpStatus.TOO_MANY_REQUESTS)
  response429(): RateLimitErrorDto {
    return {
      error: 'Too Many Requests',
      retryAfter: 60,
    };
  }

  @Get('500-server-error')
  @ApiOperation({ summary: 'Test 500 Internal Server Error response' })
  @ApiResponse({ status: 500, description: 'Internal server error', type: ErrorResponseDto })
  response500(): void {
    throw new InternalServerErrorException({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      statusCode: 500,
    });
  }

  // Different response body types
  @Get('json-object')
  @ApiOperation({ summary: 'Test JSON object response' })
  @ApiResponse({ status: 200, type: JsonObjectResponseDto })
  jsonObject(): JsonObjectResponseDto {
    return {
      key: 'example',
      value: 'data',
    };
  }

  @Get('json-array')
  @ApiOperation({ summary: 'Test JSON array response' })
  @ApiResponse({ status: 200, type: [JsonArrayItemDto] })
  jsonArray(): JsonArrayItemDto[] {
    return [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
      { id: '3', name: 'Item 3' },
    ];
  }

  @Get('text-plain')
  @ApiOperation({ summary: 'Test text/plain response' })
  @ApiProduces('text/plain')
  @ApiResponse({ status: 200, description: 'Plain text response', schema: { type: 'string' } })
  @Header('content-type', 'text/plain')
  textPlain(): string {
    return 'This is plain text';
  }

  @Get('empty-response')
  @ApiOperation({ summary: 'Test empty response body' })
  @ApiResponse({ status: 200, description: 'Empty response' })
  emptyResponse(): void {
    // Empty response
  }

  // Multiple success codes
  @Get('multiple-success/:id')
  @ApiOperation({ summary: 'Test endpoint with multiple success response codes' })
  @ApiResponse({ status: 200, description: 'Existing resource', type: MultipleStatusDto })
  @ApiResponse({ status: 201, description: 'New resource created', type: MultipleStatusDto })
  multipleSuccess(): MultipleStatusDto {
    return { result: 'success' };
  }

  // Problem Details RFC 7807 style
  @Get('problem-details')
  @ApiOperation({ summary: 'Test RFC 7807 Problem Details error format' })
  @ApiResponse({ status: 400, description: 'Problem details', type: ProblemDetailsDto })
  @HttpCode(HttpStatus.BAD_REQUEST)
  problemDetails(): ProblemDetailsDto {
    return {
      type: 'https://example.com/probs/invalid-input',
      title: 'Invalid Input',
      status: 400,
      detail: 'The provided input does not meet the requirements',
      instance: '/responses/problem-details',
    };
  }

  // Response headers
  @Get('with-headers')
  @ApiOperation({ summary: 'Test response with custom headers' })
  @ApiResponse({
    status: 200,
    type: ResponseWithHeadersDto,
    headers: {
      'X-Request-Id': { schema: { type: 'string' }, description: 'Request ID' },
      'X-RateLimit-Limit': { schema: { type: 'number' }, description: 'Rate limit' },
      'X-RateLimit-Remaining': { schema: { type: 'number' }, description: 'Remaining requests' },
      'ETag': { schema: { type: 'string' }, description: 'Entity tag' },
      'Location': { schema: { type: 'string' }, description: 'Resource location' },
    },
  })
  @Header('X-Request-Id', 'req-123')
  @Header('X-RateLimit-Limit', '1000')
  @Header('X-RateLimit-Remaining', '999')
  @Header('ETag', '"abc123"')
  @Header('Location', '/resource/123')
  withHeaders(): ResponseWithHeadersDto {
    return { message: 'Response with headers' };
  }

  @Get('retry-after')
  @ApiOperation({ summary: 'Test response with Retry-After header' })
  @ApiResponse({
    status: 503,
    description: 'Service unavailable',
    headers: {
      'Retry-After': { schema: { type: 'number' }, description: 'Retry after seconds' },
    },
  })
  @Header('Retry-After', '30')
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  retryAfter(): ErrorResponseDto {
    return {
      error: 'Service Unavailable',
      message: 'Try again later',
      statusCode: 503,
    };
  }

  @Get('content-disposition')
  @ApiOperation({ summary: 'Test response with Content-Disposition header' })
  @ApiResponse({
    status: 200,
    description: 'File download',
    headers: {
      'Content-Disposition': { schema: { type: 'string' }, description: 'Content disposition' },
    },
  })
  @Header('Content-Disposition', 'attachment; filename="data.txt"')
  contentDisposition(): string {
    return 'File content';
  }
}
