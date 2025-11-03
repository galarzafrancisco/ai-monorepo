# How to Create a Service

Services encapsulate **business logic** for a domain. They are **transport‑agnostic** (no HTTP, no Swagger) and respect **clean boundaries** between domains.

---

## Golden Rules

1) **Transport agnostic**
- ✅ Services accept **service DTOs/types** (plain TS) and return domain results.
- ❌ No `@nestjs/swagger`, no `class-validator`, no Express/HTTP concerns, no status codes.

2) **Respect domain boundaries**
- ✅ Never touch another domain’s data directly (no cross‑entity repos, no raw queries into foreign tables).
- ✅ If you need another domain, **import that module** and use **its public service API**.
- ✅ Keep integration consolidations in a thin **application layer** or a dedicated **anti‑corruption adapter**.
- ❌ Don’t bypass another domain’s service to “just read a table”.

3) **Errors**
- Throw **typed domain errors** only (see `create-error`). Controllers translate to HTTP.
- Validate *business* invariants here; *shape* validation stays in controller DTOs.

4) **Persistence**
- Use your own domain’s repository (via TypeORM/ports). No shared generic repo that couples domains.
- Transactions via `DataSource#transaction` or `QueryRunner` when a use case modifies multiple aggregates.

---

## When to Have **More Than One Service** in a Module?

**Prefer a single cohesive service** per module. Split only when doing so **improves clarity and ownership**.

Create multiple services when **any** of these hold:
- **Command vs Query separation**: write flows and read models evolve differently or have different SLAs.
  - Names: `<Entity>CommandService`, `<Entity>QueryService`.
- **Distinct sub‑domains** inside the module (e.g., pricing vs inventory):
  - Names: `<Entity>PricingService`, `<Entity>InventoryService`.
- **External integration adapters** deserve isolation (kept behind an interface):
  - Names: `<ProviderName><Purpose>Service` or `<Entity><Provider>Adapter`.

If you expose more than one service, keep a **facade** (e.g., `ProductService`) that orchestrates where appropriate, or clearly document entrypoints in the README.

---

## Naming & Files

- File: `apps/backend/src/<domain>/<domain>.service.ts` (or `product-command.service.ts`, `product-query.service.ts` when split).
- Class: `<Entity>Service` (or the split names above).
- Unit tests next to the service (or in `__tests__`).

---

## Generate

```bash
cd apps/backend
npx nest g service <domain> --no-spec
# e.g.
npx nest g service product --no-spec
```

---

## Example: Single Service (with another domain dependency)

```ts
// apps/backend/src/order/order.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrderRepository } from './order.repository'; // your port/adapter
import { CreateOrderInput, CreateOrderResult } from './dto/service/order.service.types';
import { ProductService } from '../product/product.service'; // <- interact via their public API
import { OrderDomainError } from './errors/order.errors';     // typed errors, not HTTP

@Injectable()
export class OrderService {
  constructor(
    private readonly ds: DataSource,
    private readonly orders: OrderRepository,
    private readonly productService: ProductService, // boundary respected
  ) {}

  async create(input: CreateOrderInput): Promise<CreateOrderResult> {
    // domain checks using other domain's API
    const product = await this.productService.getById(input.productId);
    if (!product || !product.isSellable) {
      throw OrderDomainError.productUnavailable(input.productId);
    }

    return this.ds.transaction(async (manager) => {
      // use repository with transactional manager
      const created = await this.orders.withManager(manager).create({
        productId: input.productId,
        qty: input.qty,
        unitPriceCents: product.priceCents,
      });
      return { id: created.id, createdAt: created.createdAt };
    });
  }
}
```

> Note: The controller adapts HTTP DTOs → `CreateOrderInput`. No Swagger here.

---

## Example: Split Command/Query Services

```ts
// apps/backend/src/product/product-command.service.ts
@Injectable()
export class ProductCommandService { /* create/update/delete logic */ }

// apps/backend/src/product/product-query.service.ts
@Injectable()
export class ProductQueryService { /* read/search logic, optimized paths */ }
```

**Criteria for split:**
- Read paths need denormalized views, caching, or different data sources.
- Write paths need strict invariants/transactions.
- Teams/ownership clearly split.

**Usage in module:**
```ts
// apps/backend/src/product/product.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  providers: [ProductCommandService, ProductQueryService],
  exports:   [ProductCommandService, ProductQueryService], // export what others may use
})
export class ProductModule {}
```

---

## Service DTOs (Internal Types)

Keep service inputs/outputs **pure**:

```ts
// apps/backend/src/order/dto/service/order.service.types.ts
export type CreateOrderInput = {
  productId: string;
  qty: number;
};

export type CreateOrderResult = {
  id: string;
  createdAt: Date;
};
```

Mapping occurs in the **controller** or a **mapper**:

```ts
// controller (sketch)
const input: CreateOrderInput = { productId: dto.productId, qty: dto.qty };
const result = await this.orderService.create(input);
return { id: result.id, createdAt: result.createdAt.toISOString() };
```

---

## Dependencies & Boundaries

- **Import modules**, don’t import repositories from other domains.
- If circular deps appear, re‑evaluate the boundary. As a last resort use `forwardRef(() => XModule)` but prefer extracting a small **interface/port** to break the cycle.
- External systems: wrap in adapters implementing **ports**; services depend on ports (interfaces), not SDKs.

---

## Transactions, Idempotency, Retries

- Wrap multi‑aggregate writes in a **transaction**.
- For externally driven commands (webhooks), design **idempotent** operations (store a dedupe key).
- For retries, keep policies in the adapter; surface **domain‑level** outcomes from the service.

---

## Logging & Metrics

- Use **structured logs** at domain points (start/end, important decisions).
- Emit **domain metrics** (e.g., `orders.created.count`) from services; avoid HTTP‑oriented metrics here.

---

## Testing

- Unit test services with in‑memory/mocked ports; don’t boot the HTTP server.
- Contract tests for adapters (ports) to ensure integrations keep promises.
- Use fixtures/builders for service DTOs; avoid leaking HTTP DTOs into service tests.

---

## Related Guides

- `create-a-controller` (adapts HTTP ↔ service)
- `create-a-dto` (API DTOs & service types)
- `create-an-entity` (persistence)
- `create-error` (typed errors & RFC7807 mapping)
- `create-a-domain`

