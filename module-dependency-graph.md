# NestJS Module Dependency Graph

## Visual Dependency Graph

```
                                    AppModule (Root)
                                         |
        +--------------------------------+--------------------------------+
        |                |               |                |               |
        |                |               |                |               |
   TaskerooModule   WikirooModule  McpRegistryModule  AgentsModule   ChatModule
        |                |               |                |               |
        |                |           +---+---+            |               |
        |                |           |       |            |               |
        +----------------+-----------+       +------------+               |
                         |                                |               |
                         v                                v               v
             AuthorizationServerModule                AdkModule    LlmHelperModule
                         |                                                 ^
                         |                                                 |
        +----------------+----------------+                                |
        |                |                |                                |
        v                v                v                                |
   AuthJourneysModule  AuthModule  IdentityProviderModule                 |
        |                |                                                 |
        |                |                                                 |
        +-------<--------+                                                 |
                                                                           |
   DiscoveryModule -------> McpRegistryModule                             |
        |                                                                  |
        +---------------> AuthorizationServerModule                       |
                                                                           |
   AppInitModule ---------> AgentsModule                                  |
        |                        |                                         |
        +------> McpRegistryModule                                        |
        |                        |                                         |
        +------> IdentityProviderModule                                   |
                                 |                                         |
                                 +-----------------------------------------+
                                             ChatModule


   AuthCoreModule (Standalone - No dependencies, provides shared types/constants)
```

## Circular Dependencies (Using forwardRef)

```
┌─────────────────────────────────────────────────────────────┐
│  Circular Dependency Cluster 1: Auth & Authorization        │
│                                                              │
│      AuthModule <────────────────> AuthorizationServerModule│
│         │              (forwardRef both ways)               │
│         │                          │                         │
│         │                          │                         │
│         │                          v                         │
│         │                    AuthJourneysModule              │
│         │                          │                         │
│         │                          │ (forwardRef)            │
│         │                          v                         │
│         │                    McpRegistryModule               │
│         │                          │                         │
│         └──────(forwardRef)────────┘                         │
│                                    │                         │
│            (forwardRef to AuthorizationServerModule)         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  Circular Dependency Cluster 2: Registry & Journeys         │
│                                                              │
│     AuthJourneysModule <──────> McpRegistryModule           │
│           (forwardRef both ways)                             │
└─────────────────────────────────────────────────────────────┘
```

## Module Import Matrix

| Module | Imports From | Uses forwardRef | Imported By |
|--------|-------------|----------------|-------------|
| **AppModule** | TaskerooModule, WikirooModule, McpRegistryModule, AuthJourneysModule, AuthorizationServerModule, DiscoveryModule, AgentsModule, ChatModule, IdentityProviderModule, AdkModule, LlmHelperModule, AppInitModule | No | N/A (root) |
| **AuthModule** | AuthorizationServerModule | ✅ Yes | AuthorizationServerModule, McpRegistryModule, AgentsModule, TaskerooModule, WikirooModule |
| **AuthCoreModule** | None | No | None (imported via barrel exports) |
| **AuthorizationServerModule** | AuthJourneysModule, McpRegistryModule, IdentityProviderModule, AuthModule | ✅ Yes | AppModule, AuthModule, McpRegistryModule, AgentsModule, TaskerooModule, WikirooModule, DiscoveryModule |
| **AuthJourneysModule** | McpRegistryModule | ✅ Yes | AppModule, AuthorizationServerModule, McpRegistryModule |
| **McpRegistryModule** | AuthJourneysModule, AuthorizationServerModule, AuthModule | ✅ Yes (3x) | AppModule, AuthorizationServerModule, AuthJourneysModule, DiscoveryModule, AppInitModule |
| **AgentsModule** | AdkModule, AuthorizationServerModule, AuthModule | No | AppModule, AppInitModule |
| **ChatModule** | AdkModule, LlmHelperModule | No | AppModule |
| **TaskerooModule** | AuthorizationServerModule, AuthModule | No | AppModule |
| **WikirooModule** | AuthorizationServerModule, AuthModule | No | AppModule |
| **DiscoveryModule** | McpRegistryModule, AuthorizationServerModule | No | AppModule |
| **AppInitModule** | AgentsModule, McpRegistryModule, IdentityProviderModule | No | AppModule |
| **IdentityProviderModule** | None (only TypeORM) | No | AppModule, AuthorizationServerModule, AppInitModule |
| **AdkModule** | None | No | AppModule, ChatModule, AgentsModule |
| **LlmHelperModule** | None | No | AppModule, ChatModule |

## Dependency Depth Analysis

### Level 0 (No External Dependencies)
- **AuthCoreModule** - Shared primitives
- **AdkModule** - AI Development Kit
- **LlmHelperModule** - LLM utilities
- **IdentityProviderModule** - User management (only TypeORM)

### Level 1 (Depends on Level 0)
- **ChatModule** → AdkModule, LlmHelperModule

### Level 2 (Circular Dependencies)
- **AuthModule** ↔ **AuthorizationServerModule** ↔ **McpRegistryModule** ↔ **AuthJourneysModule**
  - These form a tightly coupled cluster that manages authentication and authorization

### Level 3 (Depends on Level 2)
- **AgentsModule** → AdkModule, AuthorizationServerModule, AuthModule
- **TaskerooModule** → AuthorizationServerModule, AuthModule
- **WikirooModule** → AuthorizationServerModule, AuthModule
- **DiscoveryModule** → McpRegistryModule, AuthorizationServerModule

### Level 4 (Initialization)
- **AppInitModule** → AgentsModule, McpRegistryModule, IdentityProviderModule

### Root
- **AppModule** → All modules

## Critical Observations

### 1. **Central Authentication Hub**
The circular dependency cluster (AuthModule ↔ AuthorizationServerModule ↔ McpRegistryModule ↔ AuthJourneysModule) forms the authentication core:
- **Properly managed with forwardRef()** - All circular references use `forwardRef()`
- **Central to the application** - Most feature modules depend on this cluster

### 2. **Feature Module Pattern**
TaskerooModule, WikirooModule, and AgentsModule follow a consistent pattern:
- All import AuthorizationServerModule
- All import AuthModule
- Use guards for authentication
- Independent of each other

### 3. **Utility Modules**
AdkModule, LlmHelperModule, and IdentityProviderModule are leaf nodes:
- No dependencies on other business modules
- Can be easily tested in isolation
- Reusable across features

### 4. **Potential Issues**
1. **Heavy coupling in auth cluster**: The 4-module circular dependency requires careful management
2. **AuthorizationServerModule is heavily imported**: Changes here affect many modules
3. **McpRegistryModule has 3 forwardRefs**: Most complex dependency pattern

### 5. **Architectural Layers**

```
┌─────────────────────────────────────────────────────────┐
│                        AppModule                         │
└─────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼────────┐  ┌───────▼────────┐  ┌──────▼─────────┐
│ Feature Layer  │  │  Auth Cluster   │  │ Utility Layer  │
│                │  │   (Circular)    │  │                │
│ - TaskerooModule│  │ - AuthModule    │  │ - AdkModule    │
│ - WikirooModule │  │ - AuthServerMod │  │ - LlmHelper    │
│ - AgentsModule  │  │ - McpRegistry   │  │ - IdentityProv │
│ - ChatModule    │  │ - AuthJourneys  │  │                │
│ - DiscoveryMod  │  │                 │  │                │
└─────────────────┘  └─────────────────┘  └────────────────┘
        │                    │                     │
        └────────────────────┴─────────────────────┘
                            │
                    ┌───────▼────────┐
                    │   Data Layer   │
                    │   (TypeORM)    │
                    └────────────────┘
```

## Health Check: Circular Dependency Status

✅ **All circular dependencies properly handled with forwardRef()**

| Circular Relationship | Status | Notes |
|----------------------|--------|-------|
| AuthModule ↔ AuthorizationServerModule | ✅ Resolved | Both use forwardRef |
| AuthJourneysModule ↔ McpRegistryModule | ✅ Resolved | Both use forwardRef |
| McpRegistryModule → AuthorizationServerModule | ✅ Resolved | McpRegistry uses forwardRef |
| McpRegistryModule → AuthModule | ✅ Resolved | McpRegistry uses forwardRef |

## Recommendations

1. ✅ **Current state is healthy** - All circular dependencies properly managed
2. ⚠️ **Monitor the auth cluster** - The 4-module circular dependency is complex but necessary
3. 💡 **Consider extracting auth-core further** - Could move more shared code to auth-core to reduce coupling
4. 📊 **Document the auth flow** - The circular dependencies serve a purpose but need clear documentation
5. 🔧 **Keep feature modules independent** - Maintain the current pattern where feature modules don't depend on each other
