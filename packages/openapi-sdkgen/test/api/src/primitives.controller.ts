import { Controller, Get, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProperty } from '@nestjs/swagger';

/**
 * DTOs testing all primitive types and string formats
 */

export class StringFormatsDto {
  @ApiProperty({ type: String, format: 'date', example: '2024-01-15' })
  dateField: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2024-01-15T10:30:00Z' })
  dateTimeField: string;

  @ApiProperty({ type: String, format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' })
  uuidField: string;

  @ApiProperty({ type: String, format: 'email', example: 'user@example.com' })
  emailField: string;

  @ApiProperty({ type: String, format: 'uri', example: 'https://example.com/resource' })
  uriField: string;

  @ApiProperty({ type: String, format: 'hostname', example: 'example.com' })
  hostnameField: string;

  @ApiProperty({ type: String, format: 'ipv4', example: '192.168.1.1' })
  ipv4Field: string;

  @ApiProperty({ type: String, format: 'ipv6', example: '2001:0db8:85a3:0000:0000:8a2e:0370:7334' })
  ipv6Field: string;

  @ApiProperty({ type: String, format: 'byte', example: 'SGVsbG8gV29ybGQ=' })
  byteField: string;

  @ApiProperty({ type: String, format: 'binary' })
  binaryField: string;
}

export class NumericFormatsDto {
  @ApiProperty({ type: Number, format: 'int32', example: 42 })
  int32Field: number;

  @ApiProperty({ type: Number, format: 'int64', example: 9007199254740991 })
  int64Field: number;

  @ApiProperty({ type: Number, format: 'float', example: 3.14 })
  floatField: number;

  @ApiProperty({ type: Number, format: 'double', example: 3.141592653589793 })
  doubleField: number;
}

export class PrimitiveTypesDto {
  @ApiProperty({ type: String, example: 'Hello' })
  stringField: string;

  @ApiProperty({ type: Number, example: 123 })
  numberField: number;

  @ApiProperty({ type: Number, example: 456 })
  integerField: number;

  @ApiProperty({ type: Boolean, example: true })
  booleanField: boolean;

  @ApiProperty({ type: String, nullable: true, example: null })
  nullableString: string | null;

  @ApiProperty({ type: Number, nullable: true, example: null })
  nullableNumber: number | null;

  @ApiProperty({ type: Boolean, nullable: true, example: null })
  nullableBoolean: boolean | null;
}

export class OptionalFieldsDto {
  @ApiProperty({ type: String })
  requiredField: string;

  @ApiProperty({ type: String, required: false })
  optionalField?: string;

  @ApiProperty({ type: String, nullable: true })
  requiredNullable: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  optionalNullable?: string | null;

  @ApiProperty({ type: String, default: 'default-value' })
  fieldWithDefault: string;

  @ApiProperty({ type: Number, required: false, default: 42 })
  optionalWithDefault?: number;
}

export class ArrayPrimitivesDto {
  @ApiProperty({ type: [String], example: ['one', 'two', 'three'] })
  stringArray: string[];

  @ApiProperty({ type: [Number], example: [1, 2, 3] })
  numberArray: number[];

  @ApiProperty({ type: [Boolean], example: [true, false, true] })
  booleanArray: boolean[];

  @ApiProperty({ type: [String], required: false })
  optionalArray?: string[];

  @ApiProperty({ type: [String], nullable: true })
  nullableArray: string[] | null;

  @ApiProperty({ type: [String], required: false, nullable: true })
  optionalNullableArray?: string[] | null;

  @ApiProperty({ type: [[String]], example: [['a', 'b'], ['c', 'd']] })
  nestedArray: string[][];
}

export class ConstrainedFieldsDto {
  @ApiProperty({ type: String, minLength: 3, maxLength: 10 })
  constrainedString: string;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100 })
  constrainedNumber: number;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 5 })
  constrainedArray: string[];

  @ApiProperty({ type: [String], uniqueItems: true })
  uniqueArray: string[];

  @ApiProperty({ type: String, pattern: '^[A-Z]{3}$', example: 'ABC' })
  patternString: string;
}

@ApiTags('primitives')
@Controller('primitives')
export class PrimitivesController {
  @Get('string-formats')
  @ApiOperation({ summary: 'Get all string format types' })
  @ApiResponse({ status: 200, type: StringFormatsDto })
  getStringFormats(): StringFormatsDto {
    return {
      dateField: '2024-01-15',
      dateTimeField: '2024-01-15T10:30:00Z',
      uuidField: '550e8400-e29b-41d4-a716-446655440000',
      emailField: 'user@example.com',
      uriField: 'https://example.com/resource',
      hostnameField: 'example.com',
      ipv4Field: '192.168.1.1',
      ipv6Field: '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      byteField: 'SGVsbG8gV29ybGQ=',
      binaryField: 'binary-data',
    };
  }

  @Get('numeric-formats')
  @ApiOperation({ summary: 'Get all numeric format types' })
  @ApiResponse({ status: 200, type: NumericFormatsDto })
  getNumericFormats(): NumericFormatsDto {
    return {
      int32Field: 42,
      int64Field: 9007199254740991,
      floatField: 3.14,
      doubleField: 3.141592653589793,
    };
  }

  @Get('primitive-types')
  @ApiOperation({ summary: 'Get all primitive types' })
  @ApiResponse({ status: 200, type: PrimitiveTypesDto })
  getPrimitiveTypes(): PrimitiveTypesDto {
    return {
      stringField: 'Hello',
      numberField: 123,
      integerField: 456,
      booleanField: true,
      nullableString: null,
      nullableNumber: null,
      nullableBoolean: null,
    };
  }

  @Post('optional-fields')
  @ApiOperation({ summary: 'Test optional vs nullable vs default fields' })
  @ApiResponse({ status: 200, type: OptionalFieldsDto })
  testOptionalFields(@Body() dto: OptionalFieldsDto): OptionalFieldsDto {
    return dto;
  }

  @Post('array-primitives')
  @ApiOperation({ summary: 'Test arrays of primitives' })
  @ApiResponse({ status: 200, type: ArrayPrimitivesDto })
  testArrayPrimitives(@Body() dto: ArrayPrimitivesDto): ArrayPrimitivesDto {
    return dto;
  }

  @Post('constrained-fields')
  @ApiOperation({ summary: 'Test fields with validation constraints' })
  @ApiResponse({ status: 200, type: ConstrainedFieldsDto })
  testConstrainedFields(@Body() dto: ConstrainedFieldsDto): ConstrainedFieldsDto {
    return dto;
  }
}
