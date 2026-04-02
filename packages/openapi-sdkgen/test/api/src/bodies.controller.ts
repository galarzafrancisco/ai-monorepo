import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiProperty, ApiConsumes } from '@nestjs/swagger';

// Flat DTO
export class FlatBodyDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String })
  email: string;

  @ApiProperty({ type: Number })
  age: number;
}

// Nested DTO
export class AddressDto {
  @ApiProperty({ type: String })
  street: string;

  @ApiProperty({ type: String })
  city: string;

  @ApiProperty({ type: String })
  country: string;

  @ApiProperty({ type: String })
  postalCode: string;
}

export class NestedBodyDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: () => AddressDto })
  address: AddressDto;

  @ApiProperty({ type: [String] })
  phoneNumbers: string[];
}

// Deeply nested DTO
export class ContactInfoDto {
  @ApiProperty({ type: String })
  email: string;

  @ApiProperty({ type: String })
  phone: string;
}

export class CompanyDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: () => AddressDto })
  address: AddressDto;

  @ApiProperty({ type: () => ContactInfoDto })
  contactInfo: ContactInfoDto;
}

export class DeeplyNestedBodyDto {
  @ApiProperty({ type: String })
  employeeName: string;

  @ApiProperty({ type: () => CompanyDto })
  company: CompanyDto;
}

// Array of DTOs
export class ItemDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: Number })
  quantity: number;
}

export class ArrayOfDtosBodyDto {
  @ApiProperty({ type: [ItemDto] })
  items: ItemDto[];
}

// Optional and nullable fields
export class OptionalNullableBodyDto {
  @ApiProperty({ type: String })
  requiredNonNull: string;

  @ApiProperty({ type: String, nullable: true })
  requiredNullable: string | null;

  @ApiProperty({ type: String, required: false })
  optionalNonNull?: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  optionalNullable?: string | null;
}

// DTO with defaults
export class DefaultValuesBodyDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: String, default: 'active' })
  status: string;

  @ApiProperty({ type: Number, default: 0 })
  count: number;

  @ApiProperty({ type: Boolean, default: false })
  isEnabled: boolean;
}

// Map/Record-like DTO
export class RecordBodyDto {
  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { key1: 'value1', key2: 'value2' },
  })
  metadata: Record<string, string>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { metric1: 100, metric2: 200 },
  })
  metrics: Record<string, number>;
}

// Primitive request bodies
export class PrimitiveStringResponse {
  @ApiProperty({ type: String })
  received: string;
}

export class PrimitiveNumberResponse {
  @ApiProperty({ type: Number })
  received: number;
}

export class PrimitiveBooleanResponse {
  @ApiProperty({ type: Boolean })
  received: boolean;
}

// Empty body
export class EmptyBodyDto {
  // Intentionally empty
}

@ApiTags('bodies')
@Controller('bodies')
export class BodiesController {
  @Post('flat')
  @ApiOperation({ summary: 'Test flat JSON object body' })
  @ApiBody({ type: FlatBodyDto })
  @ApiResponse({ status: 200, type: FlatBodyDto })
  flatBody(@Body() dto: FlatBodyDto): FlatBodyDto {
    return dto;
  }

  @Post('nested')
  @ApiOperation({ summary: 'Test nested JSON object body' })
  @ApiBody({ type: NestedBodyDto })
  @ApiResponse({ status: 200, type: NestedBodyDto })
  nestedBody(@Body() dto: NestedBodyDto): NestedBodyDto {
    return dto;
  }

  @Post('deeply-nested')
  @ApiOperation({ summary: 'Test deeply nested JSON object body' })
  @ApiBody({ type: DeeplyNestedBodyDto })
  @ApiResponse({ status: 200, type: DeeplyNestedBodyDto })
  deeplyNestedBody(@Body() dto: DeeplyNestedBodyDto): DeeplyNestedBodyDto {
    return dto;
  }

  @Post('array-of-dtos')
  @ApiOperation({ summary: 'Test array of DTOs in body' })
  @ApiBody({ type: ArrayOfDtosBodyDto })
  @ApiResponse({ status: 200, type: ArrayOfDtosBodyDto })
  arrayOfDtos(@Body() dto: ArrayOfDtosBodyDto): ArrayOfDtosBodyDto {
    return dto;
  }

  @Post('optional-nullable')
  @ApiOperation({ summary: 'Test optional vs nullable fields' })
  @ApiBody({ type: OptionalNullableBodyDto })
  @ApiResponse({ status: 200, type: OptionalNullableBodyDto })
  optionalNullable(@Body() dto: OptionalNullableBodyDto): OptionalNullableBodyDto {
    return dto;
  }

  @Post('default-values')
  @ApiOperation({ summary: 'Test fields with default values' })
  @ApiBody({ type: DefaultValuesBodyDto })
  @ApiResponse({ status: 200, type: DefaultValuesBodyDto })
  defaultValues(@Body() dto: DefaultValuesBodyDto): DefaultValuesBodyDto {
    return dto;
  }

  @Post('record-type')
  @ApiOperation({ summary: 'Test map/record-like body with additionalProperties' })
  @ApiBody({ type: RecordBodyDto })
  @ApiResponse({ status: 200, type: RecordBodyDto })
  recordType(@Body() dto: RecordBodyDto): RecordBodyDto {
    return dto;
  }

  @Post('primitive-string')
  @ApiOperation({ summary: 'Test primitive string body' })
  @ApiConsumes('text/plain')
  @ApiBody({ schema: { type: 'string', example: 'Hello World' } })
  @ApiResponse({ status: 200, type: PrimitiveStringResponse })
  primitiveString(@Body() value: string): PrimitiveStringResponse {
    return { received: value };
  }

  @Post('primitive-number')
  @ApiOperation({ summary: 'Test primitive number body' })
  @ApiBody({ schema: { type: 'number', example: 42 } })
  @ApiResponse({ status: 200, type: PrimitiveNumberResponse })
  primitiveNumber(@Body() value: number): PrimitiveNumberResponse {
    return { received: value };
  }

  @Post('primitive-boolean')
  @ApiOperation({ summary: 'Test primitive boolean body' })
  @ApiBody({ schema: { type: 'boolean', example: true } })
  @ApiResponse({ status: 200, type: PrimitiveBooleanResponse })
  primitiveBoolean(@Body() value: boolean): PrimitiveBooleanResponse {
    return { received: value };
  }

  @Post('nullable-body')
  @ApiOperation({ summary: 'Test nullable body' })
  @ApiBody({ required: false, schema: { type: 'object', nullable: true } })
  @ApiResponse({ status: 200, description: 'Body echoed back' })
  nullableBody(@Body() dto?: any): any {
    return dto || null;
  }

  @Post('empty-body')
  @ApiOperation({ summary: 'Test empty object body' })
  @ApiBody({ type: EmptyBodyDto })
  @ApiResponse({ status: 200, type: EmptyBodyDto })
  emptyBody(@Body() dto: EmptyBodyDto): EmptyBodyDto {
    return dto;
  }

  @Post('optional-body')
  @ApiOperation({ summary: 'Test optional request body' })
  @ApiBody({ required: false, type: FlatBodyDto })
  @ApiResponse({ status: 200, description: 'Body echoed back or empty object' })
  optionalBody(@Body() dto?: FlatBodyDto): FlatBodyDto | object {
    return dto || {};
  }

  @Post('required-body')
  @ApiOperation({ summary: 'Test required request body' })
  @ApiBody({ required: true, type: FlatBodyDto })
  @ApiResponse({ status: 200, type: FlatBodyDto })
  @ApiResponse({ status: 400, description: 'Body is required' })
  requiredBody(@Body() dto: FlatBodyDto): FlatBodyDto {
    return dto;
  }

  @Post('json-array')
  @ApiOperation({ summary: 'Test JSON array body' })
  @ApiBody({ schema: { type: 'array', items: { $ref: '#/components/schemas/ItemDto' } } })
  @ApiResponse({ status: 200, schema: { type: 'array', items: { $ref: '#/components/schemas/ItemDto' } } })
  jsonArray(@Body() items: ItemDto[]): ItemDto[] {
    return items;
  }

  @Post('form-urlencoded')
  @ApiOperation({ summary: 'Test application/x-www-form-urlencoded body' })
  @ApiConsumes('application/x-www-form-urlencoded')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        age: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 200, type: FlatBodyDto })
  formUrlEncoded(@Body() dto: FlatBodyDto): FlatBodyDto {
    return dto;
  }
}
