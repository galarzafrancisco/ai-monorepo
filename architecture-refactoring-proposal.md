# Architecture Refactoring Proposal: Eliminating Circular Dependencies

## Current Problems

### 1. **Guards in Wrong Module**
`AccessTokenGuard` lives in `AuthModule` but:
- Needs `TokenService` from `AuthorizationServerModule` (creates circular dep)
- Is used by `AuthorizationServerModule`, `TaskerooModule`, `WikirooModule`, etc.

### 2. **Mixed Concerns**
- `McpRegistryController` has an auth journeys debug endpoint (line 287)
- Creates unnecessary dependency: `McpRegistryModule → AuthJourneysModule`

### 3. **Phantom Dependency**
- `McpRegistryModule` imports `AuthorizationServerModule` via forwardRef
- **No actual usage found in the code**
- Can be removed immediately

## Proposed Solutions

---

## Solution 1: Move Guards to Auth-Core (Recommended)

### Overview
Move guards and validation into `auth-core` module where shared authentication primitives belong.

### Changes Required

**1. Move AccessTokenGuard → auth-core**
```
apps/backend/src/auth-core/
  ├── guards/
  │   └── access-token.guard.ts          (moved from auth/)
  ├── validation/
  │   └── access-token-validation.service.ts  (moved from auth/)
  ├── decorators/
  │   ├── current-user.decorator.ts      (moved from auth/)
  │   └── public.decorator.ts            (moved from auth/)
  └── extractors/
      ├── access-token.extractor.ts      (moved from auth/)
      └── cookie.extractor.ts            (moved from auth/)
```

**2. Update auth-core.module.ts**
```typescript
@Module({
  imports: [
    forwardRef(() => AuthorizationServerModule), // Only this module needs TokenService
  ],
  providers: [
    AccessTokenValidationService,
    AccessTokenGuard,
  ],
  exports: [
    AccessTokenValidationService,
    AccessTokenGuard,
  ],
})
export class AuthCoreModule {}
```

**3. Delete AuthModule entirely**
- No longer needed since all its functionality moved to auth-core

**4. Update imports everywhere**
```typescript
// OLD
import { AccessTokenGuard } from 'src/auth';

// NEW
import { AccessTokenGuard } from 'src/auth-core';
```

### Dependency Graph After Change

```
auth-core → authorization-server (only for TokenService)
           ↓
    ┌──────┴──────┐
    ↓             ↓
feature modules   authorization-server endpoints
```

**No circular dependencies!**

### Pros
✅ Eliminates circular dependencies completely
✅ Guards are in a truly shared module
✅ Clear dependency direction: auth-core depends on auth-server, nothing else depends on auth-core for services
✅ Minimal changes to consuming code

### Cons
⚠️ auth-core is no longer "pure" (has a runtime dependency)
⚠️ Need to update many import statements

---

## Solution 2: Create Separate Auth-Guards Module

### Overview
Create a new `auth-guards` module specifically for guards, keeping auth-core pure.

### Changes Required

**1. Create new auth-guards module**
```
apps/backend/src/auth-guards/
  ├── guards/
  │   └── access-token.guard.ts
  ├── validation/
  │   └── access-token-validation.service.ts
  ├── decorators/
  │   ├── current-user.decorator.ts
  │   └── public.decorator.ts
  ├── extractors/
  │   ├── access-token.extractor.ts
  │   └── cookie.extractor.ts
  ├── auth-guards.module.ts
  └── index.ts
```

**2. auth-guards.module.ts**
```typescript
@Module({
  imports: [
    AuthorizationServerModule, // Needs TokenService
  ],
  providers: [
    AccessTokenValidationService,
    AccessTokenGuard,
  ],
  exports: [
    AccessTokenValidationService,
    AccessTokenGuard,
  ],
})
export class AuthGuardsModule {}
```

**3. Keep auth-core pure** (types, constants, errors only)

**4. Delete AuthModule**

### Dependency Graph After Change

```
auth-core (pure types/constants)
    ↑
    ├── auth-guards → authorization-server
    │       ↓
    │   feature modules
    │
    └── authorization-server
```

**No circular dependencies!**

### Pros
✅ Eliminates circular dependencies
✅ auth-core remains pure
✅ Clear separation: types vs runtime guards
✅ Better names (auth-guards vs generic "auth")

### Cons
⚠️ Adds another module
⚠️ Need to update import statements

---

## Solution 3: Inversion of Control - Token Validation Interface

### Overview
Define a token validation interface in auth-core, implement it in authorization-server, inject via interface.

### Changes Required

**1. Define interface in auth-core**
```typescript
// auth-core/interfaces/token-validator.interface.ts
export interface ITokenValidator {
  validateToken(token: string): Promise<AccessTokenClaims>;
}

export const TOKEN_VALIDATOR = Symbol('TOKEN_VALIDATOR');
```

**2. Implement in authorization-server**
```typescript
// authorization-server/token-validator.impl.ts
@Injectable()
export class TokenValidator implements ITokenValidator {
  constructor(private tokenService: TokenService) {}

  async validateToken(token: string): Promise<AccessTokenClaims> {
    return this.tokenService.decodeToken(token);
  }
}

// In authorization-server.module.ts
providers: [
  {
    provide: TOKEN_VALIDATOR,
    useClass: TokenValidator,
  },
  // ... other providers
]
exports: [TOKEN_VALIDATOR]
```

**3. Inject interface in guards**
```typescript
@Injectable()
export class AccessTokenGuard {
  constructor(
    @Inject(TOKEN_VALIDATOR) private validator: ITokenValidator,
    private reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const claims = await this.validator.validateToken(token);
    // ...
  }
}
```

**4. Keep guards in AuthModule, but now it doesn't need to import AuthorizationServerModule**

### Dependency Graph After Change

```
auth-core (interfaces, types, constants)
    ↑
    ├── auth-module (guards, uses interface)
    │       ↓
    │   feature modules
    │
    └── authorization-server (implements interface)
```

**No circular dependencies!**

### Pros
✅ Eliminates circular dependencies
✅ Proper dependency inversion (SOLID principles)
✅ auth-core remains pure
✅ Guards can be tested with mock validators
✅ Could swap token validation implementation easily

### Cons
⚠️ More complex (interfaces + DI)
⚠️ Less obvious what's happening (indirection)

---

## Solution 4: Quick Wins (No Circular Dep Elimination)

### Overview
Clean up unnecessary dependencies without major refactoring.

### Changes Required

**1. Remove phantom dependency**
```typescript
// mcp-registry.module.ts
imports: [
  // ... TypeORM stuff
  forwardRef(() => AuthJourneysModule),
  // Remove this line:
  // forwardRef(() => AuthorizationServerModule), ❌
  forwardRef(() => AuthModule),
],
```

**2. Move debug endpoint**
Create new debug/admin controller:
```typescript
// apps/backend/src/debug/debug.controller.ts
@Controller('debug')
@UseGuards(AccessTokenGuard)
export class DebugController {
  constructor(private authJourneysService: AuthJourneysService) {}

  @Get('servers/:serverId/auth-journeys')
  async getAuthJourneys(@Param('serverId') serverId: string) {
    // Moved from McpRegistryController
  }
}
```

This eliminates `McpRegistryModule → AuthJourneysModule`.

**3. Keep existing forwardRef() for remaining circular deps**

### Result
- Reduces from 4 circular dependencies to 2
- Less complexity
- Still has some circular deps

### Pros
✅ Easy to implement
✅ Immediate improvement
✅ No major architectural changes

### Cons
⚠️ Still have 2 circular dependencies
⚠️ Doesn't address root cause

---

## Comparison Matrix

| Solution | Complexity | Circular Deps Eliminated | Auth-Core Pure | Breaking Changes | Recommended |
|----------|-----------|-------------------------|---------------|-----------------|-------------|
| **1. Move to Auth-Core** | Low | ✅ All | ❌ No | Low | ⭐⭐⭐ |
| **2. Auth-Guards Module** | Medium | ✅ All | ✅ Yes | Low | ⭐⭐⭐⭐⭐ |
| **3. Interface Inversion** | High | ✅ All | ✅ Yes | Medium | ⭐⭐⭐ |
| **4. Quick Wins** | Low | ⚠️ Reduces to 2 | ✅ Yes | None | ⭐⭐ |

---

## Recommended Approach: Solution 2 (Auth-Guards Module)

### Why?
1. **Eliminates all circular dependencies**
2. **Maintains auth-core purity** (types, constants, errors only)
3. **Clear separation of concerns**:
   - `auth-core` = pure primitives
   - `auth-guards` = runtime authentication (guards, validators)
   - `authorization-server` = OAuth flows and token issuance
4. **Reasonable complexity** - straightforward refactoring
5. **Better naming** - "auth-guards" is more descriptive than "auth"

### Implementation Steps

1. **Create auth-guards module structure**
2. **Move guards, decorators, extractors, validation from auth/ to auth-guards/**
3. **Update auth-guards.module.ts to import AuthorizationServerModule**
4. **Delete auth/ directory entirely**
5. **Update all imports**: `'src/auth'` → `'src/auth-guards'`
6. **Remove phantom dependency**: McpRegistryModule → AuthorizationServerModule
7. **Move debug endpoint** to separate controller (optional but recommended)

### Expected Result

```
auth-core (pure: types, constants, errors)
    ↑
    ├── auth-guards → authorization-server (TokenService only)
    │       ↓
    │   All feature modules (TaskerooModule, WikirooModule, etc.)
    │
    └── authorization-server (OAuth, tokens)
            ↓
        auth-journeys ↔ mcp-registry (still circular, but acceptable - different concern)
```

**Circular dependencies:** 1 remaining (auth-journeys ↔ mcp-registry, which is a legitimate bidirectional relationship)

**Improvement:** From 4 circular dependencies to 1, and the remaining one is in a different domain (registry management, not authentication)

---

## Alternative: Pragmatic Approach

If full refactoring is too much right now, do **Solution 4 (Quick Wins)** immediately:

1. Remove unused `McpRegistryModule → AuthorizationServerModule` import (2 min)
2. Move debug endpoint to separate controller (30 min)

This reduces circular dependencies from 4 to 2 with minimal effort, then plan Solution 2 for later.

---

## Questions for Decision

1. **Is auth-core being "pure" important?** If yes → Solution 2 or 3. If no → Solution 1.
2. **How much time available?** If limited → Solution 4 now, Solution 2 later.
3. **Are circular dependencies acceptable if managed?** Current state with forwardRef() works, so this is optional refactoring.

Let me know which direction you'd like to go, and I can implement it!
