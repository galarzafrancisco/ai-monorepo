# Service Layer Review

**Review Date:** 2025-11-11
**Reviewer:** claude-reviewer
**Task:** Review services (16e7f85c-809a-4e15-bd4d-f112d5c9766e)
**Status:** ⚠️ PARTIAL COMPLIANCE (violations found)

---

## Executive Summary

**Result:** 5 out of 7 services PASS compliance review.

**Violations Found:** 2 services (Authorization.service.ts, Token.service.ts) violate transport independence by using HTTP exceptions instead of domain errors.

**Impact:** MEDIUM - These violations couple business logic to HTTP transport, preventing reuse in other protocols and breaking architectural principles.

---

## Review Scope

Reviewed all backend services:
- ✅ **Taskeroo Service** (`taskeroo.service.ts`) - 348 lines
- ✅ **Wikiroo Service** (`wikiroo.service.ts`) - 97 lines
- ✅ **MCP Registry Service** (`mcp-registry.service.ts`) - 495 lines
- ✅ **Client Registration Service** (`client-registration.service.ts`)
- ❌ **Authorization Service** (`authorization.service.ts`) - VIOLATIONS
- ❌ **Token Service** (`token.service.ts`) - VIOLATIONS
- ✅ **Auth Journeys Service** (`auth-journeys.service.ts`)

---

## Checklist Against Best Practices

Reference: `docs/review-guides/service.md` and `docs/architecture/service-transport-independence.md`

### 1. No HTTP/Transport Dependencies

| Service | Status | HTTP Exceptions Found |
|---------|--------|----------------------|
| Taskeroo | ✅ PASS | None |
| Wikiroo | ✅ PASS | None |
| MCP Registry | ✅ PASS | None |
| Client Registration | ✅ PASS | None |
| Auth Journeys | ✅ PASS | None |
| **Authorization** | ❌ FAIL | `NotFoundException` (5), `BadRequestException` (6), `UnauthorizedException` (1) |
| **Token** | ❌ FAIL | `BadRequestException` (4), `UnauthorizedException` (5) |

### 2. Domain Errors Only

| Service | Status | Evidence |
|---------|--------|----------|
| Taskeroo | ✅ PASS | Uses `TaskNotFoundError`, `InvalidStatusTransitionError`, `CommentRequiredError` |
| Wikiroo | ✅ PASS | Uses `PageNotFoundError` |
| MCP Registry | ✅ PASS | Uses `ServerNotFoundError`, `ScopeNotFoundError`, etc. (11 domain errors) |
| Client Registration | ✅ PASS | Uses `ClientNotFoundError`, `InvalidRedirectUriError`, etc. |
| Auth Journeys | ✅ PASS | No error throwing (delegates to other services) |
| **Authorization** | ❌ FAIL | Throws HTTP exceptions directly |
| **Token** | ❌ FAIL | Throws HTTP exceptions directly |

### 3. Service Types are Pure TypeScript

| Service | Status | Service Types Location |
|---------|--------|------------------------|
| Taskeroo | ✅ PASS | `dto/service/taskeroo.service.types.ts` - Pure TS types |
| Wikiroo | ✅ PASS | `dto/service/wikiroo.service.types.ts` - Pure TS types |
| MCP Registry | ✅ PASS | `dto/service/mcp-registry.service.types.ts` - Pure TS types |
| Client Registration | ✅ PASS | Uses entity directly (acceptable pattern) |
| Auth Journeys | ✅ PASS | Pure TS types |
| Authorization | ⚠️ N/A | Uses entities and DTOs |
| Token | ⚠️ N/A | Uses DTOs (but violates error handling) |

**Validation:** No `@ApiProperty`, `@IsString`, or other decorators found in service type files ✅

### 4. Proper Repository Usage

| Service | Status | Notes |
|---------|--------|-------|
| Taskeroo | ✅ PASS | Injects TaskEntity and CommentEntity repositories |
| Wikiroo | ✅ PASS | Injects WikiPageEntity repository |
| MCP Registry | ✅ PASS | Injects 4 repositories (Server, Scope, Connection, Mapping) |
| Client Registration | ✅ PASS | Injects RegisteredClientEntity repository |
| Auth Journeys | ✅ PASS | Injects multiple journey-related repositories |
| Authorization | ✅ PASS | Injects repositories (though error handling is wrong) |
| Token | ✅ PASS | No direct repository access (uses Auth Journeys service) |

### 5. Cross-Domain Interaction

| Service | Status | Evidence |
|---------|--------|----------|
| Taskeroo | ✅ PASS | No cross-domain calls |
| Wikiroo | ✅ PASS | No cross-domain calls |
| MCP Registry | ✅ PASS | No cross-domain calls |
| Client Registration | ✅ PASS | Calls `AuthJourneysService` and `McpRegistryService` via public interfaces |
| Auth Journeys | ✅ PASS | No cross-domain calls |
| Authorization | ✅ PASS | Calls `McpRegistryService` and `AuthJourneysService` |
| Token | ✅ PASS | Calls `AuthJourneysService` |

All services correctly interact with other domains via public service interfaces ✅

### 6. Logging at Domain Level

| Service | Status | Evidence |
|---------|--------|----------|
| Taskeroo | ✅ EXCELLENT | Structured logging with Logger: `{ message, taskId, name, assignee }` |
| Wikiroo | ✅ EXCELLENT | Structured logging: `{ message, pageId, title, author }` |
| MCP Registry | ✅ PASS | No logging (acceptable for CRUD operations) |
| Client Registration | ✅ PASS | Uses Logger for debug output |
| Auth Journeys | ✅ PASS | Logging present |
| Authorization | ✅ PASS | Uses Logger with domain-level messages |
| Token | ✅ PASS | Uses Logger with warnings for security events |

---

## Detailed Violation Analysis

### Authorization Service (`authorization.service.ts`)

**Location:** `apps/backend/src/authorization-server/authorization.service.ts`

**Violations:**

#### Import Statement (Line 1):
```typescript
import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
```

❌ Imports 3 HTTP exception classes

#### HTTP Exception Usage:

| Line | Exception | Context |
|------|-----------|---------|
| 37 | `NotFoundException` | "MCP server not found" |
| 45 | `NotFoundException` | "Client not found" |
| 50 | `BadRequestException` | "Redirect URI not registered" |
| 71 | `NotFoundException` | "No authorization flow found" |
| 105 | `NotFoundException` | "Authorization flow not found" |
| 127 | `NotFoundException` | "Authorization flow not found" |
| 132 | `UnauthorizedException` | "Authorization flow already completed" |
| 137 | `BadRequestException` | "Server identifier mismatch" |
| 142 | `BadRequestException` | "Invalid flow state" |
| 196 | `BadRequestException` | "Downstream connections failed" |
| 198 | `BadRequestException` | "No pending connection flows" |
| 271 | `NotFoundException` | "MCP auth flow not found" |
| 275 | `BadRequestException` | "Missing redirect URI or state" |
| 306 | `BadRequestException` | "Downstream authorization failed" |
| 318 | `NotFoundException` | "Connection flow not found" |
| 359 | `BadRequestException` | "Token exchange failed" |

**Total:** 16 HTTP exception throws

### Token Service (`token.service.ts`)

**Location:** `apps/backend/src/authorization-server/token.service.ts`

**Violations:**

#### Import Statement (Line 1):
```typescript
import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
```

❌ Imports 2 HTTP exception classes

#### HTTP Exception Usage:

| Line | Exception | Context |
|------|-----------|---------|
| 34 | `BadRequestException` | "Invalid grant_type" |
| 39 | `BadRequestException` | "Missing required parameters" |
| 50 | `UnauthorizedException` | "Invalid authorization code" |
| 56 | `UnauthorizedException` | "Client ID mismatch" |
| 62 | `UnauthorizedException` | "Authorization code already used" |
| 68 | `UnauthorizedException` | "Authorization code expired" |
| 74 | `BadRequestException` | "Redirect URI mismatch" |
| 80 | `BadRequestException` | "Missing PKCE parameters" |
| 91 | `UnauthorizedException` | "Invalid code_verifier" |

**Total:** 9 HTTP exception throws

---

## Impact Analysis

### Why These Violations Matter

1. **Transport Coupling:** Services are now tied to HTTP protocol
   - Cannot be reused in gRPC, GraphQL, or WebSocket contexts without modification
   - Violates clean architecture principles

2. **Testing Complexity:**
   - Unit tests must handle HTTP-specific exceptions
   - Cannot test business logic independently of transport layer

3. **Inconsistency:**
   - 5 services follow best practices with domain errors
   - 2 services violate principles
   - Creates architectural inconsistency

4. **Error Handling Fragility:**
   - HTTP exceptions bypass the Problem Details filter
   - No RFC 7807 compliance for these errors
   - Inconsistent error responses to clients

---

## Recommended Fixes

### Step 1: Define Domain Errors

Create `apps/backend/src/authorization-server/errors/authorization.errors.ts`:

```typescript
import { ErrorCodes } from '../../../../../packages/shared/errors/error-codes';

export const AuthorizationErrorCodes = {
  AUTH_FLOW_NOT_FOUND: ErrorCodes.AUTH_FLOW_NOT_FOUND,
  AUTH_FLOW_ALREADY_COMPLETED: ErrorCodes.AUTH_FLOW_ALREADY_COMPLETED,
  INVALID_REDIRECT_URI: ErrorCodes.INVALID_REDIRECT_URI,
  INVALID_STATE: ErrorCodes.INVALID_STATE,
  // ... etc
} as const;

export abstract class AuthorizationDomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class AuthFlowNotFoundError extends AuthorizationDomainError {
  constructor(flowId: string) {
    super(
      'Authorization flow not found.',
      AuthorizationErrorCodes.AUTH_FLOW_NOT_FOUND,
      { flowId },
    );
  }
}

export class AuthFlowAlreadyCompletedError extends AuthorizationDomainError {
  constructor(flowId: string) {
    super(
      'Authorization flow has already been completed.',
      AuthorizationErrorCodes.AUTH_FLOW_ALREADY_COMPLETED,
      { flowId },
    );
  }
}

// ... define remaining domain errors
```

### Step 2: Add Error Codes to Shared Package

In `packages/shared/errors/error-codes.ts`:

```typescript
export const ErrorCodes = {
  // ... existing codes

  // Authorization errors
  AUTH_FLOW_NOT_FOUND: 'AUTH_FLOW_NOT_FOUND',
  AUTH_FLOW_ALREADY_COMPLETED: 'AUTH_FLOW_ALREADY_COMPLETED',
  INVALID_CODE_VERIFIER: 'INVALID_CODE_VERIFIER',
  AUTHORIZATION_CODE_EXPIRED: 'AUTHORIZATION_CODE_EXPIRED',
  AUTHORIZATION_CODE_USED: 'AUTHORIZATION_CODE_USED',
  DOWNSTREAM_AUTH_FAILED: 'DOWNSTREAM_AUTH_FAILED',
  TOKEN_EXCHANGE_FAILED: 'TOKEN_EXCHANGE_FAILED',
} as const;
```

### Step 3: Add Error Catalog Entries

In `apps/backend/src/errors/http/error-catalog.ts`:

```typescript
[ErrorCodes.AUTH_FLOW_NOT_FOUND]: {
  status: 404,
  title: 'Authorization flow not found',
  type: '/errors/authz/flow-not-found',
  retryable: false,
},
[ErrorCodes.AUTH_FLOW_ALREADY_COMPLETED]: {
  status: 401,
  title: 'Authorization flow already completed',
  type: '/errors/authz/flow-already-completed',
  retryable: false,
},
// ... etc
```

### Step 4: Refactor Services

**Before:**
```typescript
if (!mcpAuthFlow) {
  throw new NotFoundException('Authorization flow not found');
}
```

**After:**
```typescript
if (!mcpAuthFlow) {
  throw new AuthFlowNotFoundError(flowId);
}
```

**Estimated Effort:**
- Authorization Service: ~16 replacements
- Token Service: ~9 replacements
- Total: 1-2 hours of work

---

## Compliant Services - Examples

### Taskeroo Service ✅

**Error Handling (`taskeroo.service.ts:70`):**
```typescript
if (!taskWithRelations) {
  throw new TaskNotFoundError(savedTask.id);
}
```

**Service Types (`dto/service/taskeroo.service.types.ts`):**
```typescript
// Service layer types - transport agnostic
export type CreateTaskInput = {
  name: string;
  description: string;
  assignee?: string;
  sessionId?: string;
};

export type TaskResult = {
  id: string;
  name: string;
  // ... pure TS types, no decorators
};
```

### MCP Registry Service ✅

**Error Handling (`mcp-registry.service.ts:94`):**
```typescript
if (!server) {
  throw new ServerNotFoundError(id);
}
```

**11 Domain Errors Defined:**
- ServerNotFoundError
- ServerAlreadyExistsError
- ScopeNotFoundError
- ScopeAlreadyExistsError
- ConnectionNotFoundError
- ConnectionNameConflictError
- MappingNotFoundError
- ServerHasDependenciesError
- ScopeHasMappingsError
- ConnectionHasMappingsError
- InvalidMappingError

---

## Service Responsibilities Analysis

### ✅ Proper Business Logic Encapsulation

All services correctly encapsulate business logic:

| Service | Responsibilities |
|---------|------------------|
| Taskeroo | Task lifecycle, status transitions, comment management, validation rules |
| Wikiroo | Wiki page CRUD, content management |
| MCP Registry | Server/scope/connection/mapping CRUD, dependency validation |
| Client Registration | OAuth client validation, credential generation, secret hashing |
| Auth Journeys | Journey orchestration, flow state management |
| Authorization | Authorization flow creation, consent processing, callback handling |
| Token | Token issuance, PKCE validation, JWT signing |

All business logic properly lives in services, not controllers ✅

### ✅ Transaction Boundaries

Services that need transactions handle them correctly:

**Example - MCP Registry (implicit transactions via TypeORM):**
```typescript
const savedServer = await this.serverRepository.save(server);
```

**Example - Client Registration (multi-step transaction):**
```typescript
const savedClient = await this.clientRepository.save(client);
const authJourney = await this.authJourneyService.createJourneyForMcpRegistration({
  mcpServerId: mcpServer.id,
  mcpClientId: savedClient.id,
});
```

---

## Logging Analysis

### ✅ Excellent Structured Logging

**Taskeroo Service:**
```typescript
this.logger.log({
  message: 'Creating task',
  name: input.name,
  assignee: input.assignee,
  sessionId: input.sessionId,
});
```

**Token Service (security events):**
```typescript
this.logger.warn(`Authorization code not found: ${tokenRequest.code}`);
this.logger.warn(`Invalid PKCE code_verifier`);
```

All logging uses domain-level context, no transport-specific details ✅

---

## Additional Findings

### ⚠️ Debug Logging in Production Code

**Client Registration Service (`client-registration.service.ts:84-90`):**
```typescript
this.logger.debug(authJourney.authorizationJourney)
this.logger.debug(authJourney.mcpAuthorizationFlow)
this.logger.debug(authJourney.connectionAuthorizationFlows)

this.logger.debug('Getting full shit')  // ⚠️ Unprofessional
const full = await this.authJourneyService.getJourneysForMcpServer(mcpServer.id);
this.logger.debug(JSON.stringify(full, null, 2));
```

**Recommendation:** Remove debug statements or make them conditional on environment.

---

## Summary Statistics

### Compliance Breakdown

| Status | Count | Percentage |
|--------|-------|------------|
| ✅ Compliant | 5 | 71% |
| ❌ Violations | 2 | 29% |

### Error Handling Patterns

| Pattern | Services |
|---------|----------|
| Domain Errors | Taskeroo, Wikiroo, MCP Registry, Client Registration, Auth Journeys (5) |
| HTTP Exceptions | Authorization, Token (2) |

### Lines of Code Reviewed

- **Total:** ~1,500+ lines across 7 services
- **Violations:** ~25 lines need refactoring

---

## Action Items

### Required (High Priority)

1. **Define Authorization Domain Errors**
   - Create `authorization.errors.ts` with 8-10 domain error classes
   - Add error codes to shared package
   - Add catalog entries

2. **Refactor Authorization Service**
   - Replace 16 HTTP exception throws with domain errors
   - Remove HTTP exception imports

3. **Refactor Token Service**
   - Replace 9 HTTP exception throws with domain errors
   - Remove HTTP exception imports

### Recommended (Medium Priority)

4. **Clean Up Debug Logging**
   - Remove or conditionalize debug statements in Client Registration Service
   - Remove unprofessional log message ("Getting full shit")

### Optional (Low Priority)

5. **Add E2E Tests**
   - Verify Problem Details responses for authorization errors
   - Test error responses match catalog

---

## Conclusion

**Overall Status:** ⚠️ **PARTIAL COMPLIANCE**

**Strong Points:**
- ✅ 5 out of 7 services fully compliant with best practices
- ✅ Excellent examples of transport-independent design (Taskeroo, Wikiroo, MCP Registry)
- ✅ Proper business logic encapsulation across all services
- ✅ Strong structured logging patterns
- ✅ Clean cross-service interaction via public interfaces

**Issues to Address:**
- ❌ Authorization and Token services violate transport independence
- ❌ 25 HTTP exceptions need replacement with domain errors
- ⚠️ Debug logging cleanup needed

**Impact:**
- MEDIUM - Architectural inconsistency affects maintainability and future protocol support
- EFFORT - 2-4 hours to fix all violations
- PRIORITY - HIGH - Should be addressed before adding new features

**Recommendation:**
Address violations in Authorization and Token services to achieve 100% compliance and architectural consistency across the codebase.

---

**Review Completed:** 2025-11-11
**Next Review:** After violations are fixed
