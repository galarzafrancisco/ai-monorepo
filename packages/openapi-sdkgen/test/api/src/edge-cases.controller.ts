import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiProperty } from '@nestjs/swagger';

// Test naming edge cases

// snake_case properties
export class SnakeCaseDto {
  @ApiProperty({ type: String, name: 'first_name' })
  first_name: string;

  @ApiProperty({ type: String, name: 'last_name' })
  last_name: string;

  @ApiProperty({ type: String, name: 'email_address' })
  email_address: string;

  @ApiProperty({ type: Number, name: 'age_in_years' })
  age_in_years: number;
}

// camelCase properties (standard)
export class CamelCaseDto {
  @ApiProperty({ type: String })
  firstName: string;

  @ApiProperty({ type: String })
  lastName: string;

  @ApiProperty({ type: String })
  emailAddress: string;

  @ApiProperty({ type: Number })
  ageInYears: number;
}

// kebab-case properties
export class KebabCaseDto {
  @ApiProperty({ type: String, name: 'first-name' })
  'first-name': string;

  @ApiProperty({ type: String, name: 'last-name' })
  'last-name': string;

  @ApiProperty({ type: Number, name: 'age-in-years' })
  'age-in-years': number;
}

// Properties with reserved TypeScript words (need special handling)
export class ReservedWordsDto {
  @ApiProperty({ type: String, name: 'default' })
  default: string;

  @ApiProperty({ type: String, name: 'class' })
  class: string;

  @ApiProperty({ type: String, name: 'function' })
  function: string;

  @ApiProperty({ type: String, name: 'package' })
  package: string;

  @ApiProperty({ type: String, name: 'export' })
  export: string;

  @ApiProperty({ type: String, name: 'import' })
  import: string;
}

// Schema with numbers in name
export class Version2Dto {
  @ApiProperty({ type: String })
  nameV2: string;

  @ApiProperty({ type: String })
  value2: string;
}

export class Item3Dto {
  @ApiProperty({ type: String })
  id3: string;
}

// Very long names
export class VeryLongNamedDataTransferObjectForTestingPurposesDto {
  @ApiProperty({ type: String })
  aVeryLongPropertyNameThatExceedsNormalLengthExpectations: string;

  @ApiProperty({ type: String })
  anotherExcessivelyLongPropertyNameForTestingEdgeCases: string;
}

// Acronyms and special casing
export class AcronymsDto {
  @ApiProperty({ type: String })
  apiKey: string;

  @ApiProperty({ type: String })
  urlPath: string;

  @ApiProperty({ type: String })
  userId: string;

  @ApiProperty({ type: String })
  oauthToken: string;

  @ApiProperty({ type: String })
  httpMethod: string;

  @ApiProperty({ type: String })
  xmlData: string;

  @ApiProperty({ type: String })
  jsonResponse: string;
}

// Circular reference (self-referential)
export class TreeNodeDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: () => [TreeNodeDto], required: false })
  children?: TreeNodeDto[];
}

// Another circular reference
export class CommentDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  text: string;

  @ApiProperty({ type: () => CommentDto, required: false, nullable: true })
  parent?: CommentDto | null;

  @ApiProperty({ type: () => [CommentDto], required: false })
  replies?: CommentDto[];
}

// Mutually recursive schemas
export class CategoryDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: () => [CategoryDto], required: false })
  subcategories?: CategoryDto[];

  @ApiProperty({ type: () => [ProductDto], required: false })
  products?: ProductDto[];
}

export class ProductDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String })
  name: string;

  @ApiProperty({ type: () => CategoryDto, required: false })
  category?: CategoryDto;
}

// Single-value enum
export enum SingleValueEnum {
  ONLY_VALUE = 'only_value',
}

export class SingleValueEnumDto {
  @ApiProperty({ enum: SingleValueEnum })
  status: SingleValueEnum;
}

// Enum with various naming conventions
export enum MixedCaseEnum {
  UPPERCASE = 'UPPERCASE',
  lowercase = 'lowercase',
  snake_case = 'snake_case',
  'kebab-case' = 'kebab-case',
  camelCase = 'camelCase',
  PascalCase = 'PascalCase',
}

export class MixedCaseEnumDto {
  @ApiProperty({ enum: MixedCaseEnum })
  value: MixedCaseEnum;
}

// Free-form object (additionalProperties: true)
export class FreeFormObjectDto {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: Object, additionalProperties: true })
  dynamicData: any;
}

// Empty object schema
export class EmptyObjectDto {
  // Intentionally empty
}

// Collision test - same name in different contexts
export class CollisionTestDto {
  @ApiProperty({ type: String })
  name: string;
}

// Another DTO with potentially colliding name
export class UserCollisionTestDto {
  @ApiProperty({ type: String })
  username: string;

  @ApiProperty({ type: () => CollisionTestDto })
  profile: CollisionTestDto;
}

@ApiTags('edge-cases')
@Controller('edge-cases')
export class EdgeCasesController {
  // Naming conventions
  @Post('naming/snake-case')
  @ApiOperation({ summary: 'Test snake_case property names' })
  @ApiResponse({ status: 200, type: SnakeCaseDto })
  testSnakeCase(@Body() dto: SnakeCaseDto): SnakeCaseDto {
    return dto;
  }

  @Post('naming/camel-case')
  @ApiOperation({ summary: 'Test camelCase property names' })
  @ApiResponse({ status: 200, type: CamelCaseDto })
  testCamelCase(@Body() dto: CamelCaseDto): CamelCaseDto {
    return dto;
  }

  @Post('naming/kebab-case')
  @ApiOperation({ summary: 'Test kebab-case property names' })
  @ApiResponse({ status: 200, type: KebabCaseDto })
  testKebabCase(@Body() dto: KebabCaseDto): KebabCaseDto {
    return dto;
  }

  @Post('naming/reserved-words')
  @ApiOperation({ summary: 'Test reserved TypeScript words as property names' })
  @ApiResponse({ status: 200, type: ReservedWordsDto })
  testReservedWords(@Body() dto: ReservedWordsDto): ReservedWordsDto {
    return dto;
  }

  @Get('naming/version2')
  @ApiOperation({ summary: 'Test schema names with numbers' })
  @ApiResponse({ status: 200, type: Version2Dto })
  testVersion2(): Version2Dto {
    return {
      nameV2: 'Version 2',
      value2: 'Value 2',
    };
  }

  @Get('naming/long-names')
  @ApiOperation({ summary: 'Test very long schema and property names' })
  @ApiResponse({ status: 200, type: VeryLongNamedDataTransferObjectForTestingPurposesDto })
  testLongNames(): VeryLongNamedDataTransferObjectForTestingPurposesDto {
    return {
      aVeryLongPropertyNameThatExceedsNormalLengthExpectations: 'long value 1',
      anotherExcessivelyLongPropertyNameForTestingEdgeCases: 'long value 2',
    };
  }

  @Get('naming/acronyms')
  @ApiOperation({ summary: 'Test acronyms in property names' })
  @ApiResponse({ status: 200, type: AcronymsDto })
  testAcronyms(): AcronymsDto {
    return {
      apiKey: 'key-123',
      urlPath: '/path/to/resource',
      userId: 'user-456',
      oauthToken: 'token-789',
      httpMethod: 'GET',
      xmlData: '<data/>',
      jsonResponse: '{"status":"ok"}',
    };
  }

  // Circular references
  @Get('circular/tree')
  @ApiOperation({ summary: 'Test self-referential tree structure' })
  @ApiResponse({ status: 200, type: TreeNodeDto })
  testTreeNode(): TreeNodeDto {
    return {
      id: 'root',
      name: 'Root Node',
      children: [
        {
          id: 'child1',
          name: 'Child 1',
          children: [
            { id: 'grandchild1', name: 'Grandchild 1' },
            { id: 'grandchild2', name: 'Grandchild 2' },
          ],
        },
        {
          id: 'child2',
          name: 'Child 2',
        },
      ],
    };
  }

  @Get('circular/comment/:id')
  @ApiOperation({ summary: 'Test circular reference with parent pointer' })
  @ApiResponse({ status: 200, type: CommentDto })
  testComment(@Param('id') id: string): CommentDto {
    return {
      id,
      text: 'This is a comment',
      parent: null,
      replies: [
        { id: 'reply1', text: 'Reply 1' },
        { id: 'reply2', text: 'Reply 2' },
      ],
    };
  }

  @Get('circular/category/:id')
  @ApiOperation({ summary: 'Test mutually recursive schemas' })
  @ApiResponse({ status: 200, type: CategoryDto })
  testCategory(@Param('id') id: string): CategoryDto {
    return {
      id,
      name: 'Electronics',
      subcategories: [
        { id: 'cat2', name: 'Computers' },
        { id: 'cat3', name: 'Phones' },
      ],
      products: [
        { id: 'prod1', name: 'Laptop' },
        { id: 'prod2', name: 'Smartphone' },
      ],
    };
  }

  // Enum edge cases
  @Post('enum/single-value')
  @ApiOperation({ summary: 'Test single-value enum' })
  @ApiResponse({ status: 200, type: SingleValueEnumDto })
  testSingleValueEnum(@Body() dto: SingleValueEnumDto): SingleValueEnumDto {
    return dto;
  }

  @Post('enum/mixed-case')
  @ApiOperation({ summary: 'Test enum with various naming conventions' })
  @ApiResponse({ status: 200, type: MixedCaseEnumDto })
  testMixedCaseEnum(@Body() dto: MixedCaseEnumDto): MixedCaseEnumDto {
    return dto;
  }

  // Free-form and empty schemas
  @Post('schema/free-form')
  @ApiOperation({ summary: 'Test free-form object with additionalProperties' })
  @ApiResponse({ status: 200, type: FreeFormObjectDto })
  testFreeForm(@Body() dto: FreeFormObjectDto): FreeFormObjectDto {
    return dto;
  }

  @Post('schema/empty')
  @ApiOperation({ summary: 'Test empty object schema' })
  @ApiResponse({ status: 200, type: EmptyObjectDto })
  testEmpty(@Body() dto: EmptyObjectDto): EmptyObjectDto {
    return dto;
  }

  // Name collision test
  @Get('collision/test')
  @ApiOperation({ summary: 'Test potential naming collisions' })
  @ApiResponse({ status: 200, type: UserCollisionTestDto })
  testCollision(): UserCollisionTestDto {
    return {
      username: 'testuser',
      profile: {
        name: 'Test Profile',
      },
    };
  }

  // Operation ID collision test (same path, different methods)
  @Get('operation-id/resource')
  @ApiOperation({ summary: 'GET operation with potential ID collision', operationId: 'getResource' })
  @ApiResponse({ status: 200, type: CollisionTestDto })
  getResource(): CollisionTestDto {
    return { name: 'Resource via GET' };
  }

  @Post('operation-id/resource')
  @ApiOperation({ summary: 'POST operation with potential ID collision', operationId: 'createResource' })
  @ApiResponse({ status: 201, type: CollisionTestDto })
  createResource(@Body() dto: CollisionTestDto): CollisionTestDto {
    return dto;
  }
}
