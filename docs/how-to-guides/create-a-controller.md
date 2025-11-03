# How to Create a Controller

Controllers are the **transport boundary** for HTTP. They **adapt** API DTOs to service inputs, call services, and **map domain results/errors to HTTP**. Keep them thin—**no business logic** here.

---

## Naming & Location

- File: `apps/backend/src/<domain>/<domain>.controller.ts` (or split by audience, e.g., `product-admin.controller.ts`).  
- Class: `<Entity>Controller` (or `<Entity>AdminController`, etc.).  
- Route path: **kebab‑case plural** (e.g., `@Controller('products')`).  
- Tag for Swagger: `@ApiTags('<Entity>')`.

**Generate:**
```bash
cd apps/backend
npx nest g controller <domain> --no-spec
# e.g.
npx nest g controller product --no-spec
```

---

## Golden Rules

1) **Transport‑only concerns**
   - ✅ Accept **Controller DTOs** (`class-validator` + Swagger).  
   - ✅ Return **Response DTOs** (never entities).  
   - ✅ Map domain errors → HTTP (via filter or manual mapping).  
   - ❌ No domain decisions, pricing, inventory rules, etc.

2) **Validation & Transformation**
   - Use global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`.  
   - Param validation via `ParseUUIDPipe`, or small `*ParamsDto` with `@IsUUID()`.

3) **AuthN/AuthZ**
   - Use guards/decorators: `@UseGuards(AuthGuard)`, `@Roles('admin')`, `@ApiBearerAuth()`.  
   - Do **not** check roles/permissions inside the service.

4) **Versioning & Stability**
   - Decorate with `@ApiOperation` and response types.  
   - Use explicit status codes & headers (`@HttpCode`, `@Header`, `@Res` only when necessary).  
   - Avoid breaking changes—introduce **new DTOs** and **new endpoints** for v2.

5) **Errors**
   - Do not throw raw strings. Throw **typed domain errors** in services; map them to RFC7807 in the controller or (preferably) in a **global exception filter**.

---

## Example (ProductController)

```ts
// apps/backend/src/product/product.controller.ts
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductCommandService } from './product-command.service';
import { ProductQueryService } from './product-query.service';
import { CreateProductDto } from './dto/product-create.dto';
import { UpdateProductDto } from './dto/product-update.dto';
import { ListProductQueryDto } from './dto/product-list-query.dto';
import { CreateProductResponseDto } from './dto/product-create-response.dto';
import { GetProductParamsDto } from './dto/product-get-params.dto';
import { AuthGuard } from '../auth/auth.guard'; // example

@ApiTags('Product')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('products')
export class ProductController {
  constructor(
    private readonly commands: ProductCommandService,
    private readonly queries: ProductQueryService,
  ) {}

  @ApiOperation({ summary: 'Create a new product' })
  @ApiCreatedResponse({ type: CreateProductResponseDto })
  @Post()
  async create(@Body() dto: CreateProductDto): Promise<CreateProductResponseDto> {
    const result = await this.commands.create({
      name: dto.name,
      description: dto.description,
      category: dto.category,
      unitPriceCents: dto.unitPriceCents,
      quantity: dto.quantity ?? 0,
    });
    return { id: result.id, createdAt: result.createdAt.toISOString() };
  }

  @ApiOperation({ summary: 'List products with filters & pagination' })
  @ApiOkResponse({ description: 'Returns a paginated list', schema: {
    properties: {
      items: { type: 'array', items: { $ref: '#/components/schemas/CreateProductResponseDto' } },
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
    }
  }})
  @Get()
  async list(@Body() query: ListProductQueryDto) {
    const { items, total, page, limit } = await this.queries.list(query);
    return { items, total, page, limit };
  }

  @ApiOperation({ summary: 'Get a product by id' })
  @ApiOkResponse({ type: CreateProductResponseDto })
  @Get(':id')
  async getOne(@Param() params: GetProductParamsDto): Promise<CreateProductResponseDto> {
    const r = await this.queries.getById(params.id);
    // Convert to response DTO
    return { id: r.id, createdAt: r.createdAt.toISOString() };
  }

  @ApiOperation({ summary: 'Update a product' })
  @ApiOkResponse({ type: CreateProductResponseDto })
  @Patch(':id')
  async update(
    @Param() params: GetProductParamsDto,
    @Body() dto: UpdateProductDto,
  ): Promise<CreateProductResponseDto> {
    const r = await this.commands.update(params.id, dto);
    return { id: r.id, createdAt: r.updatedAt.toISOString() };
  }

  @ApiOperation({ summary: 'Delete a product' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remove(@Param() params: GetProductParamsDto): Promise<void> {
    await this.commands.remove(params.id);
  }
}
```

> Notes:
> - The controller passes **pure service types** to the service.  
> - Swagger decorators document each route.  
> - No domain logic lives here.

---

## Parameter, Query & Body DTOs

- **Path params**: `GetProductParamsDto` with `@IsUUID('4') id`.  
- **Query**: `ListProductQueryDto` with coercion via `@Transform` and validation (`page`, `limit`, filters).  
- **Body**: `CreateProductDto`, `UpdateProductDto`.  
- **Response**: `*ResponseDto`—control exposure, never return entities.

---

## Error Mapping (RFC7807)

Prefer a **global exception filter** translating domain errors → Problem Details:

```ts
// apps/backend/src/http/problem-details.filter.ts (sketch)
@Catch(DomainError)
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(err: DomainError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const status = mapDomainErrorToStatus(err.code);
    res.status(status).json({
      type: `https://errors.example.com/${err.code}`,
      title: err.message,
      status,
      detail: err.detail,
      instance: ctx.getRequest().url,
    });
  }
}
```

Register filter in `main.ts` once. Controllers then just `throw` domain errors from services.

---

## Auth, Guards, Pipes, Interceptors

- **Guards**: Authentication/authorization only.  
- **Pipes**: Validation & transformation at the boundary.  
- **Interceptors**: Cross‑cutting concerns (logging, caching, timing, response mapping).  
- **Filters**: Error translation.  
- Avoid `@Res()` unless you need streaming or fine header control—it disables auto‑serialization.

---

## Pagination, Sorting, Filtering

- Accept `page`, `limit`, `sort`, `direction`, and filters via a **Query DTO**.  
- Enforce sane defaults and max `limit`.  
- Document in Swagger (`@ApiPropertyOptional`).

---

## Idempotency & Safety

- **POST**: If external callers may retry, support an **Idempotency-Key** header (store & dedupe in service).  
- **PUT/PATCH/DELETE**: Return correct status codes (`200/204`). Don’t leak internal error details.

---

## Related Guides

- `create-a-service` (business logic)  
- `create-a-dto` (request/response contracts)  
- `create-an-entity` (persistence)  
- `create-error` (domain errors & RFC7807)  
- `create-a-domain`

