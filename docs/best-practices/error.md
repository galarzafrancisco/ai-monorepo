# Error Handling & Propagation — Best Practices

This document defines **how errors are modeled, propagated, and exposed** across our stack.

It is the **source of truth** for error design in all services (Backend API and Frontend).
Implementation details and step-by-step examples will live in separate "How-To" guides.

---

## 📖 Core Principles

1. **Errors carry meaning, not implementation details.**  
   An error should tell *what went wrong* in business terms — not *how* or *where* it failed.

2. **Separate concerns:**  
   - **Domain errors** describe business or logical problems inside an app.  
   - **Transport errors** describe how those problems are sent across the network (HTTP, gRPC, etc.).

3. **Error boundaries convert formats, not meanings.**  
   - Within a process → throw/handle typed `DomainError`s.  
   - Across processes → emit/consume a stable data format (RFC 7807 Problem Details).

4. **Each error has a stable, product-level code.**  
   Codes are short, upper-snake-case identifiers (`PRODUCT_NOT_FOUND`, `AUTH_INVALID_CREDENTIALS`) that never change once published.

5. **The contract is the data shape, not the class.**  
   Never rely on exception class names across services; rely on `code`, `status`, and `context`.

6. **Mapping happens only at boundaries.**  
   Services throw domain errors → controllers map them → HTTP clients parse them → frontends present them.

7. **Human messages are for users; codes are for machines.**  
   UI logic, retries, and telemetry key on `code`, not on `title` or `detail`.

8. **Every error must be traceable.**  
   Include a correlation or `requestId` in all Problem Details and log entries.

---

## 🧩 Domain Errors

**Purpose:** represent business logic failures inside a service.

- Extend a common `DomainError` base.  
- Contain: `message`, `code`, and optional safe `context`.  
- **Never** reference HTTP or transport details.

```ts
export abstract class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly context?: Record<string, any>,
  ) {
    super(message);
  }
}
```

Example:
```ts
export class ProductNotFoundError extends DomainError {
  constructor(productId: string) {
    super('Product not found.', 'PRODUCT_NOT_FOUND', { productId });
  }
}
```

---

## 🌐 HTTP Representation — RFC 7807 Problem Details

All public HTTP APIs must emit errors as
`Content-Type: application/problem+json` per [RFC 7807](https://datatracker.ietf.org/doc/html/rfc7807).

```json
{
  "type": "https://errors.example.com/catalog/products/not-found",
  "title": "Product not found",
  "status": 404,
  "detail": "The requested product does not exist.",
  "instance": "/products/123",
  "code": "PRODUCT_NOT_FOUND",
  "context": { "productId": "123" },
  "requestId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "retryable": false
}
```

### Mandatory fields

| Field | Description |
|-------|--------------|
| `type` | URI identifying the error class (stable linkable doc). |
| `title` | Short human-readable summary. |
| `status` | HTTP status code. |
| `code` | Stable machine code. |
| `detail` | Optional extended explanation (safe to show to user). |
| `context` | Optional structured metadata (non-PII). |
| `requestId` | Correlates logs across systems. |
| `retryable` | Hints whether client can retry. |

---

## 🗺️ Mapping Rules

| Layer | Input | Output | Notes |
|-------|--------|--------|-------|
| **Service** | `DomainError` | Throws it | No HTTP coupling. |
| **Controller** | `DomainError` | `ProblemDetails` + HTTP status | Uses mapping table. |
| **Frontend** | `ProblemDetails` | `UiError` (localized message) | Keys UI logic on `code`. |

---

## 🧭 Error Codes

- Declared centrally in a shared package (`packages/errors`).
- Exported as constants for reuse across services.

```ts
export const ErrorCodes = {
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

### Code Guidelines
| Rule | Explanation |
|------|--------------|
| **Stable** | Once released, never repurpose or remove. |
| **Concise** | Uppercase snake case, ≤ 40 chars. |
| **Unique** | No collisions across domains. |
| **Documented** | Listed with description and HTTP status in the error catalogue. |

---

## 🧮 Error Catalogue

Each service maintains a small mapping from `code` → `{status, title, type}`.  
Example:

| Code | HTTP Status | Title | Type (URI) |
|------|--------------|-------|-----------|
| `PRODUCT_NOT_FOUND` | 404 | Product not found | `/catalog/products/not-found` |
| `VALIDATION_FAILED` | 400 | Invalid input | `/catalog/validation/failed` |
| `INTERNAL_ERROR` | 500 | Internal Server Error | `/catalog/internal` |

---

## 🔄 Propagation Across Boundaries

### Backend API → Frontend
- API emits `ProblemDetails` in `application/problem+json` format.
- Frontend parses and validates the payload using the shared schema.
- Frontend maps error codes to localized messages for display.
- Never leak internal stack traces or implementation info.
- Keep `code` values stable for UI logic and analytics.

---

## 🧱 Schema Sharing

A lightweight shared package (`packages/errors`) contains:

- `ErrorCodes` (constants)
- `ProblemDetails` TypeScript type and runtime schema (e.g. Zod)
- `parseProblemDetails()` validator for clients

This ensures type safety and consistency across Backend API and Frontend.

---

## 🔍 Validation & Mapping

- Request validation errors must also emit RFC 7807 payloads.  
  Use `VALIDATION_FAILED` with a `context.fields` map for per-field messages.
- Unknown errors default to `INTERNAL_ERROR (500)` with a generic title.

---

## 🔐 Security & Logging

- Never include secrets, stack traces, or PII in `detail` or `context`.
- Log the full stack server-side with the same `requestId`.
- Emit structured logs: `{ code, status, requestId, userId?, path, durationMs }`.

---

## 📊 Monitoring & Metrics

Track error rates by `code` and category.  
Set alerts for spikes or sustained ratios (e.g., `PRODUCT_NOT_FOUND > 5%`).

---

## 🧩 Frontend Handling

- Map `code → i18n key + message`.
- Display generic fallback for unknown codes.
- Use `retryable` to control retry buttons.
- Surface `requestId` in support logs.

---

## 🚫 Common Anti-Patterns

❌ Throwing `HttpException` directly from services.  
❌ Serializing exception class names over HTTP.  
❌ Duplicating message strings across layers.  
❌ Returning inconsistent JSON shapes for errors.  
❌ Swallowing errors without logging requestId and code.  
❌ Mixing transport concerns (HTTP status) inside domain logic.

---

## ✅ Summary Checklist

| Area | Rule | Status |
|------|------|--------|
| Domain | Define `DomainError` subclasses, no HTTP refs | ✅ |
| Transport | Use RFC 7807 Problem Details | ✅ |
| Codes | Shared constants, stable & documented | ✅ |
| Mapping | Done at boundaries only | ✅ |
| Schema | Shared `ProblemDetails` type & validator | ✅ |
| Logging | Include `requestId` & `code` in all logs | ✅ |
| Security | No PII in responses | ✅ |

---

> **Philosophy:**  
> Build errors as part of your product’s interface, not as afterthoughts.  
> Stable codes, clear mappings, and consistent shapes make systems observable, debuggable, and user-friendly.
