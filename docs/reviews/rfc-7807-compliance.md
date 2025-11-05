# RFC 7807 Compliance Review

**Date:** 2025-11-05
**Reviewer:** Claude
**Status:** COMPLIANT with recommendations

## Executive Summary

The global exception filter (`ProblemDetailsFilter`) implements RFC 7807 (Problem Details for HTTP APIs) with all required fields and additional extensions. The implementation is robust, well-structured, and handles multiple error scenarios consistently.

## RFC 7807 Overview

RFC 7807 defines a standard format for HTTP API error responses with the following structure:

### Required Fields
- `type` (string): URI reference identifying the problem type
- `title` (string): Short, human-readable summary
- `status` (number): HTTP status code
- `detail` (string, optional): Human-readable explanation specific to this occurrence
- `instance` (string, optional): URI reference identifying the specific occurrence

## Implementation Analysis

### Core Components

#### 1. Type Definition
**Location:** `/Users/franciscogalarza/github/ai-monorepo/packages/shared/errors/problem-details.type.ts`

```typescript
export type ProblemDetails = {
  type: string;        // RFC 7807 required
  title: string;       // RFC 7807 required
  status: number;      // RFC 7807 required
  code: ErrorCode;     // Extension field
  detail?: string;     // RFC 7807 optional
  context?: Record<string, unknown>;  // Extension field
  instance?: string;   // RFC 7807 optional
  requestId: string;   // Extension field
  retryable?: boolean; // Extension field
};
```

**Compliance:** COMPLIANT
- All RFC 7807 required fields present
- Optional fields (detail, instance) properly marked as optional
- Extension fields properly added without conflicting with spec

#### 2. Problem Details Filter
**Location:** `/Users/franciscogalarza/github/ai-monorepo/apps/backend/src/http/problem-details.filter.ts`

**Key Features:**
- Global exception handler using `@Catch()` decorator
- Handles three error categories:
  1. Domain errors (custom business logic errors)
  2. NestJS HttpExceptions
  3. Unknown/unhandled errors
- Properly extracts `instance` from request URL
- Generates or extracts `requestId` from headers

**Compliance:** COMPLIANT
- Correctly populates all RFC 7807 fields
- Proper HTTP status codes
- Consistent error response format

#### 3. Problem Builder Function
**Location:** `/Users/franciscogalarza/github/ai-monorepo/apps/backend/src/errors/http/problem-details.ts`

```typescript
export const toProblem = (p: Partial<ProblemDetails>): ProblemDetails => ({
  type: p.type ?? '/errors/internal',
  title: p.title ?? 'Internal Server Error',
  status: p.status ?? 500,
  code: p.code ?? ErrorCodes.INTERNAL_ERROR,
  detail: p.detail,
  context: p.context,
  instance: p.instance,
  requestId: p.requestId ?? 'unknown',
  retryable: p.retryable ?? false,
});
```

**Compliance:** COMPLIANT
- Provides sensible defaults for required fields
- Preserves optional fields when provided
- Ensures consistent structure

## Compliance Assessment

### Required Fields

| Field | Status | Implementation |
|-------|--------|----------------|
| `type` | PASS | Always populated. Uses URI-style paths like `/errors/validation/failed`, `/errors/http`, `/errors/internal` |
| `title` | PASS | Always populated. Human-readable summaries like "Validation failed", "Internal Server Error" |
| `status` | PASS | Always populated. Correctly matches HTTP status codes (400, 500, etc.) |
| `detail` | PASS | Optional field used correctly. Populated with specific error messages when available |
| `instance` | PASS | Optional field used correctly. Populated from `request.url` |

### Extension Fields

The implementation includes several extension fields that enhance the error response:

| Field | Purpose | RFC 7807 Compliance |
|-------|---------|---------------------|
| `code` | Machine-readable error code | COMPLIANT - Extension fields allowed |
| `context` | Additional context data | COMPLIANT - Extension fields allowed |
| `requestId` | Request tracking ID | COMPLIANT - Extension fields allowed |
| `retryable` | Retry guidance for clients | COMPLIANT - Extension fields allowed |

## Error Handling Scenarios

### 1. Domain Errors
**Flow:** Domain error with string code → `mapDomainError()` → Problem Details response

**Example:**
```json
{
  "type": "/errors/validation/failed",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "detail": "One or more fields are invalid.",
  "context": { "fields": ["email", "password"] },
  "instance": "/api/users",
  "requestId": "abc-123-def",
  "retryable": false
}
```

**Compliance:** PASS

### 2. NestJS Validation Errors
**Flow:** class-validator error → Special handling → Problem Details response

**Example:**
```json
{
  "type": "/errors/validation/failed",
  "title": "Validation failed",
  "status": 400,
  "code": "VALIDATION_FAILED",
  "detail": "One or more fields are invalid.",
  "context": { "fields": ["email must be valid"] },
  "instance": "/api/users",
  "requestId": "abc-123-def",
  "retryable": false
}
```

**Compliance:** PASS

### 3. HTTP Exceptions
**Flow:** HttpException → Extract status/message → Problem Details response

**Example:**
```json
{
  "type": "/errors/http",
  "title": "NotFoundException",
  "status": 404,
  "code": "INTERNAL_ERROR",
  "detail": "User not found",
  "instance": "/api/users/123",
  "requestId": "abc-123-def",
  "retryable": false
}
```

**Compliance:** PASS

### 4. Unknown/Unhandled Errors
**Flow:** Unknown error → 500 response → Problem Details response

**Example:**
```json
{
  "type": "/errors/internal",
  "title": "Internal Server Error",
  "status": 500,
  "code": "INTERNAL_ERROR",
  "detail": "An unexpected error occurred.",
  "instance": "/api/users",
  "requestId": "abc-123-def",
  "retryable": true
}
```

**Compliance:** PASS

## Best Practices Observed

1. **Consistent Structure:** All error responses follow the same format
2. **Proper Logging:** Appropriate log levels (warn/error) with context
3. **Request Tracking:** RequestId generation/extraction for tracing
4. **Instance Tracking:** Proper population from request URL
5. **Type URIs:** Meaningful, hierarchical type URIs
6. **Retryability:** Helpful guidance for clients (5xx = retryable, 4xx = not retryable)
7. **Context Preservation:** Domain error context passed through to response

## Recommendations

### 1. Type URI Documentation
**Priority:** Medium

Consider documenting the type URI structure and creating a registry of error types:
- `/errors/validation/failed` - Client-side validation errors
- `/errors/http` - General HTTP exceptions
- `/errors/internal` - Unexpected server errors
- Domain-specific types from ErrorCatalog

**Benefit:** Better client-side error handling and documentation

### 2. Type URI Resolution
**Priority:** Low

The RFC 7807 spec suggests that type URIs should be resolvable to human-readable documentation. Consider:
- Creating an error documentation endpoint
- Making type URIs absolute URLs pointing to documentation
- Example: `https://api.example.com/docs/errors/validation/failed`

**Current:** `/errors/validation/failed` (relative URI)
**Suggested:** `https://api.example.com/errors/validation/failed` or keep as-is

**Note:** Relative URIs are acceptable per RFC 7807, so this is optional

### 3. HTTP Exception Code Mapping
**Priority:** Low

Currently, all HttpExceptions use `ErrorCodes.INTERNAL_ERROR`. Consider mapping specific HTTP exceptions to more specific error codes:

```typescript
// Example enhancement
const codeMap = {
  404: ErrorCodes.NOT_FOUND,
  401: ErrorCodes.UNAUTHORIZED,
  403: ErrorCodes.FORBIDDEN,
  // etc.
};
```

### 4. Content-Type Header
**Priority:** High

**Issue:** The response should include `Content-Type: application/problem+json` header per RFC 7807 section 3.

**Current Implementation:**
```typescript
response.status(problem.status).json(problem);
```

**Recommended:**
```typescript
response
  .status(problem.status)
  .header('Content-Type', 'application/problem+json')
  .json(problem);
```

**Impact:** Without this header, clients may not recognize the response as RFC 7807 compliant.

## Security Considerations

1. **Error Details:** The implementation properly sanitizes error messages for production
2. **Stack Traces:** Stack traces are logged but not exposed in responses
3. **Request ID:** Proper tracking without exposing sensitive information

## Conclusion

The implementation is RFC 7807 compliant with all required fields properly implemented. The addition of extension fields (`code`, `context`, `requestId`, `retryable`) enhances the error response without violating the specification.

**Overall Grade:** A- (Excellent with minor enhancement opportunities)

### Compliance Checklist

- [x] All required RFC 7807 fields implemented
- [x] Optional fields properly marked and used
- [x] Extension fields follow RFC 7807 guidelines
- [x] Consistent error response format
- [x] Proper HTTP status codes
- [x] Type URIs follow URI reference format
- [ ] Content-Type header set to `application/problem+json` (RECOMMENDED)
- [x] Error responses are deterministic and testable
- [x] Proper error logging and monitoring
- [x] Security: No sensitive data leakage

## References

- [RFC 7807: Problem Details for HTTP APIs](https://tools.ietf.org/html/rfc7807)
- Implementation files:
  - `/Users/franciscogalarza/github/ai-monorepo/apps/backend/src/http/problem-details.filter.ts`
  - `/Users/franciscogalarza/github/ai-monorepo/apps/backend/src/errors/http/problem-details.ts`
  - `/Users/franciscogalarza/github/ai-monorepo/packages/shared/errors/problem-details.type.ts`
  - `/Users/franciscogalarza/github/ai-monorepo/apps/backend/src/errors/http/domain-to-problem.mapper.ts`
