# How to Create a Domain

Every new backend feature or domain in our NestJS app should follow this structure.

---

## 1. Module (always)

**Why:** Every feature lives inside a NestJS module to encapsulate providers, controllers, and imports.

**Command:**
```bash
cd apps/backend
npx nest g module <domain>
# e.g.
npx nest g module product
```

---

## 2. Service (very likely)

**Why:** Business logic should live in a provider (service), not in controllers or entities.

**How-to:** See [create-a-service](create-a-service.md).

**Command:**
```bash
npx nest g service <domain> --no-spec
# e.g.
npx nest g service product --no-spec
```


---

## 3. Entity (if it touches the database)

**Why:** Persistence needs a TypeORM entity (plus repository via TypeORM DataSource).

**How-to:** See [create-an-entity](create-an-entity.md).

You’ll typically add `src/<domain>/<domain>.entity.ts` and wire it in the module with `TypeOrmModule.forFeature([YourEntity])`.


---

## 4. Controller (if it’s exposed via API)

**Why:** REST endpoints live in a controller; map service results/errors to HTTP.

**How-to:** See [create-a-controller](create-a-controller.md).

**Command:**
```bash
npx nest g controller <domain> --no-spec
# e.g.
npx nest g controller product --no-spec
```


---

## 5. DTOs (for request/response contracts)

**Why:** Validate and document payloads; keep transport types out of services.

Files usually live under `src/<domain>/dto/`.

**How-to:** See [create-a-dto](create-a-dto.md).

---

## 6. Errors (almost always)

**Why:** Define stable, shared error codes and throw typed domain errors from services; controllers translate to RFC7807 responses.

**How-to:** See [create-error](create-error.md).

---

### Suggested Layout (Example: `product`)

```
apps/backend/src/
  product/
    product.module.ts
    product.service.ts
    product.controller.ts        # if API-exposed
    product.entity.ts            # if DB-backed
    dto/
      product.dto.ts
      product-create.dto.ts
      product-create-response.dto.ts
      product-update.dto.ts
      product-update-response.dto.ts
    errors/
      product.errors.ts          # domain errors & codes
```

---

Start with the module, add a service, then layer in entity/controller/DTOs/errors as needed, using the how-to guides:
- [create-a-service](create-a-service.md)
- [create-an-entity](create-an-entity.md)
- [create-a-controller](create-a-controller.md)
- [create-a-dto](create-a-dto.md)
- [create-error](create-error.md)
