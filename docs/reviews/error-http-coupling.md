# Error HTTP Coupling Review

**Review Date:** 2025-11-05
**Task ID:** a6e96ee1-c7be-4dc3-9ab7-22a12316b2cd
**Status:** ✅ PASSED

## Executive Summary

This review validates that domain errors in the Tasks and Context modules are properly decoupled from HTTP concerns. The architecture successfully implements transport-agnostic errors with HTTP mapping at the appropriate boundary layer.

**Key Finding:** The application demonstrates excellent separation of concerns with NO HTTP coupling in domain error classes.

## Review Scope

### Modules Reviewed
1. **Tasks** (`apps/backend/src/tasks`)
2. **Context** (`apps/backend/src/context`)

### Files Examined
- Domain error classes
- Error catalogs and mappers
- HTTP filters and controllers
- Shared error types

## Findings

### 1. Domain Error Classes (✅ CLEAN)

#### Tasks Domain Errors
**File:** `/apps/backend/src/tasks/errors/tasks.errors.ts`

All Tasks domain errors extend `TasksDomainError` base class with:
- ✅ NO HTTP status codes
- ✅ NO HTTP headers
- ✅ Transport-agnostic error codes (strings)
- ✅ Optional context for debugging
- ✅ Clear, descriptive error messages

**Error Classes:**
```typescript
- TasksDomainError (abstract base)
- TaskNotFoundError
- TaskNotAssignedError
- InvalidStatusTransitionError
- CommentRequiredError
```

**Structure:**
```typescript
export abstract class TasksDomainError extends Error {
  constructor(
    message: string,
    readonly code: TasksErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

#### Context Domain Errors
**File:** `/apps/backend/src/context/errors/context.errors.ts`

All Context domain errors extend `ContextDomainError` base class with:
- ✅ NO HTTP status codes
- ✅ NO HTTP headers
- ✅ Transport-agnostic error codes (strings)
- ✅ Optional context for debugging
- ✅ Clear, descriptive error messages

**Error Classes:**
```typescript
- ContextDomainError (abstract base)
- PageNotFoundError
```

**Structure:**
```typescript
export abstract class ContextDomainError extends Error {
  constructor(
    message: string,
    readonly code: ContextErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
```

### 2. Error Codes (✅ CLEAN)

**File:** `/packages/shared/errors/error-codes.ts`

Error codes are pure string constants with NO HTTP information:
```typescript
export const ErrorCodes = {
  // Task errors
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  TASK_NOT_ASSIGNED: 'TASK_NOT_ASSIGNED',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  COMMENT_REQUIRED: 'COMMENT_REQUIRED',

  // Context errors
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',

  // Generic errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
```

### 3. HTTP Mapping Layer (✅ PROPERLY SEPARATED)

#### Error Catalog
**File:** `/apps/backend/src/errors/http/error-catalog.ts`

HTTP concerns are centralized in a dedicated catalog that maps error codes to HTTP metadata:
```typescript
export const ErrorCatalog: Record<
  string,
  {
    status: number;        // HTTP-specific
    title: string;
    type: string;          // RFC 7807 type URI
    retryable?: boolean;
  }
> = {
  [ErrorCodes.TASK_NOT_FOUND]: {
    status: 404,
    title: 'Task not found',
    type: '/errors/tasks/not-found',
    retryable: false,
  },
  // ... other mappings
};
```

#### Domain-to-Problem Mapper
**File:** `/apps/backend/src/errors/http/domain-to-problem.mapper.ts`

Converts domain errors to RFC 7807 Problem Details:
```typescript
export function mapDomainError(
  e: { code: string; message: string; context?: Record<string, unknown> },
  requestId: string,
  instance?: string,
) {
  const meta = ErrorCatalog[e.code] ?? ErrorCatalog[ErrorCodes.INTERNAL_ERROR];
  return toProblem({
    ...meta,
    code: e.code as any,
    detail: e.message,
    context: e.context,
    requestId,
    instance,
  });
}
```

#### Global Exception Filter
**File:** `/apps/backend/src/http/problem-details.filter.ts`

The `ProblemDetailsFilter` is the boundary where HTTP coupling occurs:
- Catches all exceptions globally
- Detects domain errors by checking for string `code` property
- Maps domain errors to RFC 7807 Problem Details using `mapDomainError()`
- Handles NestJS validation errors
- Provides fallback for unknown errors

**Key logic:**
```typescript
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    // Domain error: has a string code
    if (exception?.code && typeof exception.code === 'string') {
      const problem = mapDomainError(exception, requestId, instance);
      response.status(problem.status).json(problem);
      return;
    }
    // ... other handlers
  }
}
```

### 4. Controller Layer (✅ CLEAN)

#### Tasks Controller
**File:** `/apps/backend/src/tasks/tasks.controller.ts`

Controllers do NOT catch or transform errors:
- Domain errors propagate naturally to the global filter
- Controllers focus on request/response mapping
- NO error handling logic in controllers

#### Context Controller
**File:** `/apps/backend/src/context/context.controller.ts`

Same pattern as Tasks:
- Domain errors propagate naturally
- NO error handling in controllers

### 5. Service Layer (✅ CLEAN)

Both `TasksService` and `ContextService` throw domain errors directly:

**Example from Context:**
```typescript
async getPageById(pageId: string): Promise<PageResult> {
  const page = await this.pageRepository.findOne({ where: { id: pageId } });

  if (!page) {
    throw new PageNotFoundError(pageId);  // Domain error, NO HTTP
  }

  return this.mapToResult(page);
}
```

## Architecture Pattern

The application follows a clean layered architecture for error handling:

```
┌─────────────────────────────────────────────────────────┐
│  Domain Layer (Tasks/Context)                        │
│  - Pure domain errors (TaskNotFoundError, etc.)         │
│  - String error codes (TASK_NOT_FOUND, etc.)            │
│  - NO HTTP coupling                                     │
└──────────────────┬──────────────────────────────────────┘
                   │ throws
                   ↓
┌─────────────────────────────────────────────────────────┐
│  Service Layer                                           │
│  - Business logic                                        │
│  - Throws domain errors                                 │
│  - NO HTTP coupling                                     │
└──────────────────┬──────────────────────────────────────┘
                   │ propagates
                   ↓
┌─────────────────────────────────────────────────────────┐
│  Controller Layer                                        │
│  - Request/response mapping                             │
│  - NO error handling                                    │
│  - Errors propagate to filter                           │
└──────────────────┬──────────────────────────────────────┘
                   │ propagates
                   ↓
┌─────────────────────────────────────────────────────────┐
│  HTTP Boundary (ProblemDetailsFilter)                   │
│  - Global exception filter                              │
│  - Maps domain errors → RFC 7807 Problem Details        │
│  - Applies HTTP status codes via ErrorCatalog           │
│  - THIS IS WHERE HTTP COUPLING OCCURS                   │
└─────────────────────────────────────────────────────────┘
```

## Benefits of Current Architecture

1. **Transport Agnostic:** Domain errors can be reused for GraphQL, gRPC, or CLI
2. **Centralized HTTP Mapping:** All HTTP concerns in one place (`ErrorCatalog`)
3. **Consistent API Responses:** RFC 7807 Problem Details format
4. **Debuggability:** Rich context preserved in domain errors
5. **Type Safety:** TypeScript ensures error codes are valid
6. **Separation of Concerns:** Business logic doesn't know about HTTP

## Recommendations

### Current State: EXCELLENT ✅

The current implementation is exemplary and requires NO changes:

1. ✅ Domain errors are completely HTTP-agnostic
2. ✅ HTTP mapping occurs at the proper boundary (filter layer)
3. ✅ Error catalog centralizes HTTP metadata
4. ✅ Controllers don't handle errors
5. ✅ RFC 7807 Problem Details for consistent API responses

### Optional Enhancements (Future)

If the application grows, consider:

1. **Error Monitoring Integration:** Add structured logging with error tracking service
2. **Error Documentation:** Generate OpenAPI error schemas from ErrorCatalog
3. **Client Error Types:** Export error codes to shared package for client-side handling
4. **Error Rate Limiting:** Track retryable errors for circuit breaker patterns

## Conclusion

**Status:** ✅ PASSED

The Tasks and Context modules demonstrate best-in-class separation of domain errors from HTTP concerns. No remediation required.

**Key Strengths:**
- Zero HTTP coupling in domain errors
- Clean architecture with proper layering
- Centralized HTTP mapping via ErrorCatalog
- RFC 7807 compliance for API responses
- Excellent debuggability with context preservation

This architecture serves as a reference implementation for error handling in clean architecture applications.

---

**Reviewed by:** Claude (AI Code Assistant)
**Task ID:** a6e96ee1-c7be-4dc3-9ab7-22a12316b2cd
**Branch:** review-yolo-error-http-coupling
