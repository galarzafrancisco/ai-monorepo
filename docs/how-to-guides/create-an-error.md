# How-to: Errors (for Backend API → Frontend)

This guide turns the Error Best Practices into concrete steps, files, and naming rules you can copy-paste into the monorepo. It covers project structure, class and file names, boundary mapping, the error catalogue, and how to add new errors and wire them through all layers.

---

## 0) TL;DR design

- **Domain errors live inside each module** (e.g., `product/errors/product.errors.ts`). They’re **HTTP‑agnostic** and include a stable `code` and safe `context`.
- **Transport mapping happens at the boundary** (controller/global filter) via a service‑local **Error Catalog** → emits **`application/problem+json`** (RFC 7807 shape + our extensions).
- **Codes + schema are shared** under `packages/shared/errors` so UI can reason on the same `code`, `status`, `retryable`, `requestId`, etc.
- Modules may **re‑export their subset of codes** for convenience (so engineers rarely open the shared package).

---

## 1) Repository structure (updated)

```
.
├─ apps/
│  ├─ backend/
│  │  └─ src/
│  │     ├─ product/
│  │     │  ├─ product.module.ts
│  │     │  ├─ product.service.ts
│  │     │  ├─ product.controller.ts        # if API-exposed
│  │     │  ├─ product.entity.ts            # if DB-backed
│  │     │  ├─ dto/
│  │     │  │  ├─ product.dto.ts
│  │     │  │  ├─ product-create.dto.ts
│  │     │  │  ├─ product-create-response.dto.ts
│  │     │  │  ├─ product-update.dto.ts
│  │     │  │  └─ product-update-response.dto.ts
│  │     │  └─ errors/
│  │     │     └─ product.errors.ts         # domain errors (+ module code re-exports)
│  │     ├─ errors/
│  │     │  ├─ http/
│  │     │  │  ├─ problem-details.ts        # RFC7807 helpers (transport only)
│  │     │  │  ├─ error-catalog.ts          # code -> {status,title,type,retryable}
│  │     │  │  ├─ domain-to-problem.mapper.ts
│  │     │  │  └─ problem.exception-filter.ts
│  │     │  └─ index.ts
│  └─ ui/
│     └─ src/errors/…                        # code -> i18n & UX mapping
├─ packages/
│  └─ shared/
│     └─ errors/
│        ├─ error-codes.ts                   # SOURCE OF TRUTH for codes
│        ├─ problem-details.type.ts          # TS type + Zod validator
│        └─ index.ts
```

> Why keep a central `error-codes.ts`?
> So **UI isn't surprised** by new strings and can rely on a single registry. Modules re‑export their subset for ergonomics, but strings originate centrally to avoid drift.

---

## 2) Shared package (unchanged)

### `packages/shared/errors/error-codes.ts`
```ts
export const ErrorCodes = {
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  // add new global codes here
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

### `packages/shared/errors/problem-details.type.ts`
```ts
import { z } from 'zod';
import type { ErrorCode } from './error-codes';

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;                // stable machine code
  detail?: string;
  context?: Record<string, unknown>;
  instance?: string;
  requestId: string;
  retryable?: boolean;
};

export const ProblemDetailsSchema = z.object({
  type: z.string().url().or(z.string().startsWith('/')),
  title: z.string(),
  status: z.number().int(),
  code: z.string(),
  detail: z.string().optional(),
  context: z.record(z.unknown()).optional(),
  instance: z.string().optional(),
  requestId: z.string(),
  retryable: z.boolean().optional(),
});

export const parseProblemDetails = (data: unknown): ProblemDetails =>
  ProblemDetailsSchema.parse(data);
```

---

## 3) Module‑local domain errors

**File:** `apps/backend/src/product/errors/product.errors.ts`  
Owns **domain error classes** for the Product module, plus a **module‑scoped view** of codes.

```ts
// apps/backend/src/product/errors/product.errors.ts

import { ErrorCodes } from '../../../../packages/shared/errors/error-codes';

// Optional: module-scoped re-export of just what Product uses.
export const ProductErrorCodes = {
  PRODUCT_NOT_FOUND: ErrorCodes.PRODUCT_NOT_FOUND,
} as const;

type ProductErrorCode = typeof ProductErrorCodes[keyof typeof ProductErrorCodes];

// Keep HTTP out of domain errors.
export abstract class ProductDomainError extends Error {
  constructor(
    message: string,
    readonly code: ProductErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class ProductNotFoundError extends ProductDomainError {
  constructor(productId: string) {
    super('Product not found.', ProductErrorCodes.PRODUCT_NOT_FOUND, { productId });
  }
}
```

> You can group multiple related errors in this single file (e.g., `ProductAlreadyArchivedError`, `ProductSkuConflictError`, …). If it grows too large, split by topic inside the same folder.

---

## 4) Throwing errors in the module service

```ts
// apps/backend/src/product/product.service.ts
import { ProductNotFoundError } from './errors/product.errors';

async getById(id: string) {
  const product = await this.repo.findOne({ where: { id } });
  if (!product) throw new ProductNotFoundError(id);
  return product;
}
```

---

## 5) Transport mapping (boundary) — unchanged pattern

**Catalog maps stable codes to HTTP metadata.**

### `apps/backend/src/errors/http/error-catalog.ts`
```ts
import { ErrorCodes } from '../../../../packages/shared/errors/error-codes';

export const ErrorCatalog: Record<string, {
  status: number; title: string; type: string; retryable?: boolean;
}> = {
  [ErrorCodes.PRODUCT_NOT_FOUND]: {
    status: 404,
    title: 'Product not found',
    type: '/catalog/products/not-found',
  },
  [ErrorCodes.VALIDATION_FAILED]: {
    status: 400,
    title: 'Invalid input',
    type: '/catalog/validation/failed',
  },
  [ErrorCodes.INTERNAL_ERROR]: {
    status: 500,
    title: 'Internal Server Error',
    type: '/catalog/internal',
  },
};
```

### `apps/backend/src/errors/http/problem-details.ts`
```ts
import { ProblemDetails } from '../../../../packages/shared/errors/problem-details.type';

export const toProblem = (p: Partial<ProblemDetails>): ProblemDetails => ({
  type: p.type ?? '/catalog/internal',
  title: p.title ?? 'Internal Server Error',
  status: p.status ?? 500,
  code: p.code ?? 'INTERNAL_ERROR',
  detail: p.detail,
  context: p.context,
  instance: p.instance,
  requestId: p.requestId ?? 'unknown',
  retryable: p.retryable ?? false,
});
```

### `apps/backend/src/errors/http/domain-to-problem.mapper.ts`
```ts
import { ErrorCatalog } from './error-catalog';
import { toProblem } from './problem-details';

/**
 * Accepts *any* domain error shape that carries { code, message, context? }.
 * Works with module-local domain errors.
 */
export function mapDomainError(
  e: { code: string; message: string; context?: any },
  reqId: string,
  instance?: string,
) {
  const meta = ErrorCatalog[e.code] ?? ErrorCatalog.INTERNAL_ERROR;
  return toProblem({
    ...meta,
    code: e.code,
    detail: e.message,
    context: e.context,
    requestId: reqId,
    instance,
  });
}
```

### `apps/backend/src/errors/http/problem.exception-filter.ts`
```ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpAdapterHost } from '@nestjs/common';
import { mapDomainError } from './domain-to-problem.mapper';

@Catch()
export class ProblemExceptionFilter implements ExceptionFilter {
  constructor(private readonly http: HttpAdapterHost) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx      = host.switchToHttp();
    const request  = ctx.getRequest<Request>() as any;
    const response = ctx.getResponse<Response>() as any;
    const requestId = (request.headers['x-request-id'] as string) || crypto.randomUUID();
    const instance  = request.url;

    // Module-local domain error: has a string code
    if (exception?.code && typeof exception.code === 'string') {
      const problem = mapDomainError(exception, requestId, instance);
      this.http.httpAdapter.reply(response, problem, problem.status);
      return;
    }

    // Nest ValidationPipe → normalize to VALIDATION_FAILED
    if (exception?.name === 'BadRequestException' && exception['response']?.message) {
      const problem = {
        type: '/catalog/validation/failed',
        title: 'Invalid input',
        status: 400,
        code: 'VALIDATION_FAILED',
        detail: 'One or more fields are invalid.',
        context: { fields: exception['response'].message },
        requestId, instance, retryable: false,
      };
      this.http.httpAdapter.reply(response, problem, 400);
      return;
    }

    // Unknown → INTERNAL_ERROR
    const problem = {
      type: '/catalog/internal',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'An unexpected error occurred.',
      requestId, instance, retryable: false,
    };
    this.http.httpAdapter.reply(response, problem, 500);
  }
}
```

> Because the mapper only relies on `exception.code/message/context`, it works seamlessly with module‑local error classes.

---

## 6) UI (unchanged)

- **UI**: parse `ProblemDetails` from backend, key UX on `code` (and `retryable`), not `title`. Include `requestId` in support links.

---

## 7) Adding a new error (with module‑local errors)

1) **Register the code once** in `packages/shared/errors/error-codes.ts`.
   ```ts
   export const ErrorCodes = {
     ...ErrorCodes,
     PRODUCT_SKU_CONFLICT: 'PRODUCT_SKU_CONFLICT',
   } as const;
   ```

2) **Create the module‑local domain error**.
   ```ts
   // apps/backend/src/product/errors/product.errors.ts
   export class ProductSkuConflictError extends ProductDomainError {
     constructor(sku: string) {
       super('SKU already in use.', ProductErrorCodes.PRODUCT_SKU_CONFLICT, { sku });
     }
   }
   ```

3) **Map in the service’s Error Catalog**.
   ```ts
   // apps/backend/src/errors/http/error-catalog.ts
   [ErrorCodes.PRODUCT_SKU_CONFLICT]: {
     status: 409, title: 'SKU conflict', type: '/catalog/products/sku-conflict', retryable: false
   },
   ```

4) **Throw from business logic** in `product.service.ts`.

5) **UI message** for `PRODUCT_SKU_CONFLICT`.

7) **Docs**: add a row in the service error catalogue doc (status, title, type).

---

## 8) Conventions summary

- **Module file name:** `apps/backend/src/<module>/errors/<module>.errors.ts`
- **Domain base class:** `<Module>DomainError` (e.g., `ProductDomainError`).
- **Class names:** `<Module><What><Error>` (e.g., `ProductNotFoundError`).
- **Codes:** live centrally in `packages/shared/errors/error-codes.ts`; module files **re‑export** their subset (`ProductErrorCodes`) for clarity.
- **Transport files (global):** `apps/backend/src/errors/http/*` (shared for the service).
- **Never** leak HTTP into domain errors; never leak secrets/PII into `detail/context`.

---

## 9) FAQ

**Why keep codes centralized if errors are module‑local?**  
To **avoid drift and collisions**. A single registry also helps analytics and UI reliability. Modules re‑export their slice so authors don’t need to browse the central file each time.

**Can a module define a brand‑new code without touching shared?**  
Technically yes, but it will **break consumers** that expect shared codes. If you truly need an experimental code, add it behind a feature flag and **register it centrally** before release.

**What if the error catalog differs per service?**  
That’s expected. Catalogs are **service‑local**: same code may map to different `status/title/type` across services if semantics differ—though prefer consistency whenever possible.
