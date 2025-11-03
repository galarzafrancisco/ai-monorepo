# How to Create a DTO

Data Transfer Objects (DTOs) define the **shape of data crossing boundaries** (HTTP ↔ controller ↔ service). They provide **validation**, **documentation (Swagger/OpenAPI)**, and a **stable contract** for clients and internal modules.

---

## Naming & File Conventions

- **File name:** `<entity>-<verb><optional: -response>.dto.ts`  
  Examples: `product-create.dto.ts`, `product-update.dto.ts`, `product-list.dto.ts`, `product-create-response.dto.ts`.
- **Class name:** `VerbEntity(Response)Dto`  
  Examples: `CreateProductDto`, `UpdateProductDto`, `ListProductDto`, `CreateProductResponseDto`.
- **Location:** `apps/backend/src/<domain>/dto/`.

---

## Controller DTOs vs Service DTOs

**Controller DTOs** (a.k.a. API DTOs):
- Used at the **transport boundary** (HTTP request/response).
- **MUST** use `class-validator` **and** `@nestjs/swagger` decorators for validation and API docs.
- May use `class-transformer` for parsing, coercion, and field exposure.
- Example: `CreateProductDto`, `ListProductQueryDto`, `ProductResponseDto`.

**Service DTOs** (internal application contracts):
- **Transport-agnostic** (no `@ApiProperty`, no `class-validator`). Keep them **pure TypeScript** (`type` or `interface`, or simple classes without decorators).
- Represent **business inputs/outputs** the service actually needs (may diverge from HTTP payloads).
- Mapping from Controller DTO → Service DTO happens either in the controller or a dedicated mapper.

> TL;DR: **Don’t leak transport concerns into the service layer.** Controllers adapt/validate/transform, services stay clean.

---

## Required Packages

```bash
npm i class-validator class-transformer @nestjs/swagger swagger-ui-express
```

Ensure global validation pipe (usually in `main.ts`):
```ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

---

## Authoring Rules (Best Practices)

1. **Document everything for Swagger**
   - Every exposed field **must** have `@ApiProperty()`/`@ApiPropertyOptional()` with `description`, `example`, and type hints when needed.
2. **Validate all inputs**
   - Use `class-validator` decorators (`@IsString`, `@IsEnum`, `@IsUUID`, `@IsInt`, `@IsPositive`, `@IsOptional`, etc.).
   - For arrays, include `each: true`. For numeric strings, use `@Transform` and `@IsInt`.
3. **Use DTOs for responses**
   - **Never** return entities directly. Create `*ResponseDto` and control exposure with `class-transformer` (`@Exclude`, `@Expose`).
4. **Keep service layer clean**
   - Convert Controller DTOs to Service DTOs (plain types). Avoid importing Swagger/validator into services.
5. **Enum discipline**
   - Centralize enums per domain; document with `enum` + `enumName` in `@ApiProperty` for nice Swagger rendering.
6. **Handle partial updates**
   - Use `PartialType(CreateXDto)` from `@nestjs/swagger` for PATCH/partial updates.
7. **Nested validation**
   - Use `@ValidateNested({ each: true })` & `@Type(() => ChildDto)` for nested objects/arrays.
8. **Query DTOs**
   - Create a separate `*QueryDto` for query-string filters/pagination; **coerce types** with `@Transform`.
9. **Parameters DTOs**
   - For path params (`/users/:id`), create a small `*ParamsDto` with `@IsUUID()`/`@IsString()`.
10. **Deprecations & versioning**
    - Mark deprecated fields with `@ApiPropertyOptional({ deprecated: true })`. Never silently remove in the same API version.
11. **Consistent messages**
    - Provide `description` for every field. Use consistent phrasing and examples.
12. **Security & privacy**
    - **Do not** expose sensitive fields (passwords, secrets, internal identifiers). Validate but never echo them back.
13. **Dates & times**
    - Accept ISO-8601 strings (`@IsISO8601()`), convert to `Date` with `@Type(() => Date)` only if the service requires `Date`.
14. **Numeric safety**
    - For money, prefer **integers of minor units** (e.g., cents). Document unit conventions clearly in field descriptions.
15. **Error alignment**
    - Validate to prevent domain errors early. When throwing, use your domain error patterns and RFC7807 mapping in controllers.

---

## Examples

### A. Create Request DTO (`product-create.dto.ts`) — Controller DTO

```ts
// apps/backend/src/product/dto/product-create.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsPositive, IsString, Length } from 'class-validator';

export enum ProductCategory {
  FOOD = 'FOOD',
  ELECTRONICS = 'ELECTRONICS',
  APPAREL = 'APPAREL',
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Human-readable product name. 3–120 characters.',
    example: 'Noise-Cancelling Headphones',
  })
  @IsString()
  @Length(3, 120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Optional short description for marketing and listing pages.',
    example: 'Wireless over-ear headphones with active noise cancellation.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Category of the product.',
    enum: ProductCategory,
    example: ProductCategory.ELECTRONICS,
  })
  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @ApiProperty({
    description: 'Unit price in **cents** (minor currency units). Must be a positive integer.',
    example: 25999,
  })
  @IsInt()
  @IsPositive()
  unitPriceCents!: number;

  @ApiPropertyOptional({
    description: 'Initial stock count (>= 0). If omitted, defaults to 0.',
    example: 50,
  })
  @IsOptional()
  @IsInt()
  // Allow zero: validate non-negative with a custom constraint if needed.
  quantity?: number;
}
```

### B. Update Request DTO (`product-update.dto.ts`) — Controller DTO (Partial)

```ts
// apps/backend/src/product/dto/product-update.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './product-create.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

### C. Response DTO (`product-create-response.dto.ts`) — Controller DTO

```ts
// apps/backend/src/product/dto/product-create-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductResponseDto {
  @ApiProperty({
    description: 'Server-generated unique identifier (UUID).',
    example: '34c59d14-6f63-464b-98f4-3d8d990098af',
  })
  id!: string;

  @ApiProperty({
    description: 'Creation timestamp in ISO-8601 format.',
    example: '2025-10-31T23:59:59.123Z',
  })
  createdAt!: string;
}
```

### D. Query DTO (`product-list-query.dto.ts`) — Controller DTO (Query String)

```ts
// apps/backend/src/product/dto/product-list-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProductCategory } from './product-create.dto';

export class ListProductQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search across name/description.', example: 'headphones' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Filter by category.', enum: ProductCategory, example: ProductCategory.ELECTRONICS })
  @IsOptional()
  @IsEnum(ProductCategory)
  category?: ProductCategory;

  @ApiPropertyOptional({ description: 'Page number starting at 1.', example: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Page size (1–100).', example: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
```

### E. Params DTO (`product-get-params.dto.ts`) — Controller DTO (Path Params)

```ts
// apps/backend/src/product/dto/product-get-params.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GetProductParamsDto {
  @ApiProperty({ description: 'Product ID (UUID).', example: '34c59d14-6f63-464b-98f4-3d8d990098af' })
  @IsUUID('4')
  id!: string;
}
```

### F. Nested DTOs (`product-bundle-create.dto.ts`)

```ts
// apps/backend/src/product/dto/product-bundle-create.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CreateProductDto } from './product-create.dto';

export class CreateProductBundleDto {
  @ApiProperty({ description: 'Products included in the bundle.' , type: [CreateProductDto]})
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductDto)
  items!: CreateProductDto[];

  @ApiPropertyOptional({ description: 'Optional display name for the bundle.' })
  @IsOptional()
  name?: string;
}
```

### G. Service DTOs (pure types)

```ts
// apps/backend/src/product/dto/service/product.service.types.ts
export type CreateProductInput = {
  name: string;
  description?: string;
  category: 'FOOD' | 'ELECTRONICS' | 'APPAREL';
  unitPriceCents: number;
  quantity?: number;
};

export type CreateProductResult = {
  id: string;
  createdAt: Date;
};
```

Mapping example (inside controller):
```ts
@Post()
@ApiOkResponse({ type: CreateProductResponseDto })
create(
  @Body() dto: CreateProductDto,
): Promise<CreateProductResponseDto> {
  const input: CreateProductInput = {
    name: dto.name,
    description: dto.description,
    category: dto.category,
    unitPriceCents: dto.unitPriceCents,
    quantity: dto.quantity ?? 0,
  };
  const result = await this.productService.create(input);
  return { id: result.id, createdAt: result.createdAt.toISOString() };
}
```

---

## Swagger Tips

- For unions/polymorphism, use `@ApiExtraModels()` on the controller and `@ApiOkResponse({ schema: ... })` or `oneOf`.
- For arrays: `@ApiProperty({ type: [ChildDto] })`.
- For enums: `@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })`.
- Use `@ApiQuery()` for ad-hoc query params when not using a DTO (prefer DTOs though).
- Hide internal fields with `@ApiHideProperty()` if you keep them on the class for internal use.

---

## Related Guides

- `create-a-controller`
- `create-a-service`
- `create-an-entity`
- `create-a-domain`
- `create-error`

