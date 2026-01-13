# Actual Service Usage in Circular Dependencies

## Summary of Findings

| Module A | Module B | Why A imports B | Is it real? | Used where |
|----------|----------|----------------|-------------|------------|
| **AuthGuardsModule** | AuthorizationServerModule | Needs `TokenService` | ✅ YES (Service) | `AccessTokenValidationService` constructor |
| **AuthorizationServerModule** | AuthGuardsModule | Needs `AccessTokenGuard` | ⚠️ CONTROLLER ONLY | `AuthorizationController` decorators |
| **AuthorizationServerModule** | AuthJourneysModule | Needs `AuthJourneysService` | ✅ YES (Service) | 3 services inject it |
| **AuthorizationServerModule** | McpRegistryModule | Needs `McpRegistryService` | ✅ YES (Service) | 3 services inject it |
| **AuthJourneysModule** | McpRegistryModule | Needs `McpRegistryService` | ✅ YES (Service) | `AuthJourneysService` uses it |
| **AuthJourneysModule** | AuthGuardsModule | Needs `AccessTokenGuard` | ⚠️ CONTROLLER ONLY | `AuthJourneysController` decorator |
| **McpRegistryModule** | AuthGuardsModule | Needs `AccessTokenGuard` | ⚠️ CONTROLLER ONLY | `McpRegistryController` decorator |
| **McpRegistryModule** | AuthJourneysModule | ??? | ❌ NO - PHANTOM | Not used anywhere! |

---

## Detailed Analysis

### 1. AuthGuardsModule → AuthorizationServerModule ✅

**Import:**
```typescript
// auth-guards.module.ts
imports: [forwardRef(() => AuthorizationServerModule)]
```

**Used by:**
```typescript
// auth-guards/validation/access-token-validation.service.ts
export class AccessTokenValidationService {
  constructor(private readonly tokenService: TokenService) {}

  async validateAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.tokenService.decodeToken(token);
  }
}
```

**Real dependency:** ✅ **YES** - Service-level dependency. AccessTokenValidationService needs TokenService.

---

### 2. AuthorizationServerModule → AuthGuardsModule ⚠️

**Import:**
```typescript
// authorization-server.module.ts
imports: [forwardRef(() => AuthGuardsModule)]
```

**Used by:**
```typescript
// authorization-server/authorization.controller.ts
@UseGuards(AccessTokenGuard)
export class AuthorizationController {
  @Get('flow/:flowId')
  @UseGuards(AccessTokenGuard)
  async getFlow(@CurrentUser() user: UserContext) { }

  @Post('authorize/mcp/:serverIdentifier/:version')
  @UseGuards(AccessTokenGuard)
  async authorizeConsent(@CurrentUser() user: UserContext) { }
}
```

**Services:** NONE - No service in AuthorizationServerModule injects anything from AuthGuardsModule

**Real dependency:** ⚠️ **CONTROLLER-ONLY** - Only used for controller decorators, not services

---

### 3. AuthorizationServerModule → AuthJourneysModule ✅

**Import:**
```typescript
// authorization-server.module.ts
imports: [AuthJourneysModule]  // Direct import, not forwardRef
```

**Used by:**
```typescript
// authorization-server/client-registration.service.ts
constructor(private readonly authJourneyService: AuthJourneysService) {}

// authorization-server/authorization.service.ts
constructor(private readonly authJourneysService: AuthJourneysService) {}

// authorization-server/token.service.ts
constructor(private readonly authJourneysService: AuthJourneysService) {}
```

**Real dependency:** ✅ **YES** - Multiple services need AuthJourneysService

---

### 4. AuthorizationServerModule → McpRegistryModule ✅

**Import:**
```typescript
// authorization-server.module.ts
imports: [McpRegistryModule]  // Direct import
```

**Used by:**
```typescript
// authorization-server/client-registration.service.ts
constructor(private readonly mcpRegistryService: McpRegistryService) {}

// authorization-server/token-exchange.service.ts
constructor(private readonly mcpRegistryService: McpRegistryService) {}

// authorization-server/authorization.service.ts
constructor(private readonly mcpRegistryService: McpRegistryService) {}
```

**Real dependency:** ✅ **YES** - Multiple services need McpRegistryService

---

### 5. AuthJourneysModule → McpRegistryModule ✅

**Import:**
```typescript
// auth-journeys.module.ts
imports: [forwardRef(() => McpRegistryModule)]
```

**Used by:**
```typescript
// auth-journeys/auth-journeys.service.ts
export class AuthJourneysService {
  constructor(private readonly mcpRegistryService: McpRegistryService) {}

  async createJourneyForMcpRegistration(input: CreateAuthJourneyInput) {
    const mcpServer = await this.mcpRegistryService.getServerById(input.mcpServerId);
    // ...
  }
}
```

**Real dependency:** ✅ **YES** - AuthJourneysService needs McpRegistryService.getServerById()

---

### 6. AuthJourneysModule → AuthGuardsModule ⚠️

**Import:**
```typescript
// auth-journeys.module.ts
imports: [forwardRef(() => AuthGuardsModule)]
```

**Used by:**
```typescript
// auth-journeys/auth-journeys.controller.ts
@Controller('auth-journeys')
@UseGuards(AccessTokenGuard)
export class AuthJourneysController { }
```

**Services:** NONE - AuthJourneysService doesn't inject anything from AuthGuardsModule

**Real dependency:** ⚠️ **CONTROLLER-ONLY** - Only used for controller guard decorator

---

### 7. McpRegistryModule → AuthGuardsModule ⚠️

**Import:**
```typescript
// mcp-registry.module.ts
imports: [forwardRef(() => AuthGuardsModule)]
```

**Used by:**
```typescript
// mcp-registry/mcp-registry.controller.ts
@Controller('mcp')
@UseGuards(AccessTokenGuard)
export class McpRegistryController { }
```

**Services:** NONE - McpRegistryService doesn't inject anything from AuthGuardsModule

**Real dependency:** ⚠️ **CONTROLLER-ONLY** - Only used for controller guard decorator

---

### 8. McpRegistryModule → AuthJourneysModule ❌

**Import:**
```typescript
// mcp-registry.module.ts - LINE 20
imports: [forwardRef(() => McpRegistryModule)]  // ← This was removed!
```

**Used by:** NOTHING - No grep results found

**Real dependency:** ❌ **PHANTOM - ALREADY REMOVED** during refactoring

---

## Circular Dependency Cycles

### Cycle 1: AuthGuards ↔ AuthorizationServer
```
AuthGuardsModule → AuthorizationServerModule (needs TokenService)
         ↑                    ↓
         └────────────────────┘ (needs AccessTokenGuard - CONTROLLER ONLY)
```
- **AuthGuards → AuthServer:** Service dependency (AccessTokenValidationService needs TokenService)
- **AuthServer → AuthGuards:** Controller-only dependency (AuthorizationController uses guard)

### Cycle 2: Through AuthJourneys
```
AuthorizationServerModule → AuthJourneysModule (3 services need AuthJourneysService)
                                    ↓
                             AuthGuardsModule (CONTROLLER ONLY)
                                    ↓
                         AuthorizationServerModule (needs TokenService)
```

### Cycle 3: Through McpRegistry
```
AuthorizationServerModule → McpRegistryModule (3 services need McpRegistryService)
                                    ↓
                             AuthGuardsModule (CONTROLLER ONLY)
                                    ↓
                         AuthorizationServerModule (needs TokenService)
```

---

## Key Insight: Controller-Only Dependencies

The circular dependencies involving:
- AuthJourneysModule → AuthGuardsModule
- McpRegistryModule → AuthGuardsModule
- AuthorizationServerModule → AuthGuardsModule

Are **controller-only dependencies** - they only need AccessTokenGuard for the `@UseGuards()` decorator, not for any service logic.

### Potential Solutions:

1. **Global Guard:** Make AccessTokenGuard a global guard, eliminating the need to import AuthGuardsModule into every module that has protected controllers

2. **Extract Controllers:** Move controllers to separate modules that import AuthGuardsModule, keeping service modules pure

3. **Accept Controller Dependencies:** NestJS circular dependencies caused by guards/decorators are common and acceptable when using forwardRef()
