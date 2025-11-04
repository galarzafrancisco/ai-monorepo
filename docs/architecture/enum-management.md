# Enum Management

## Overview

This document describes the centralized enum management pattern used in the backend to ensure proper separation of concerns and enable enum sharing across layers and packages.

## Architecture

### Centralized Enum Location

Enums are defined in dedicated `enums/` directories within each module, separate from entity files.

```
src/
└── taskeroo/
    ├── enums/
    │   ├── task-status.enum.ts   # Enum definition
    │   └── index.ts               # Barrel export
    ├── task.entity.ts             # Imports from enums/
    ├── dto/
    │   └── *.dto.ts               # Imports from enums/
    └── taskeroo.service.ts        # Imports from enums/
```

### Why Not in Entity Files?

**❌ Previous Pattern (Anti-pattern)**:
```typescript
// task.entity.ts
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  FOR_REVIEW = 'FOR_REVIEW',
  DONE = 'DONE',
}

@Entity()
export class TaskEntity {
  @Column({ type: 'text', enum: TaskStatus })
  status!: TaskStatus;
}
```

**Problems**:
1. **Tight coupling**: Enum is coupled to the database layer
2. **Import pollution**: DTOs must import from entity files
3. **Circular dependency risk**: Can cause issues in complex module structures
4. **Semantically incorrect**: Enums are domain concepts, not database artifacts

**✅ Current Pattern**:
```typescript
// enums/task-status.enum.ts
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  FOR_REVIEW = 'FOR_REVIEW',
  DONE = 'DONE',
}

// enums/index.ts
export { TaskStatus } from './task-status.enum';

// task.entity.ts
import { TaskStatus } from './enums';

@Entity()
export class TaskEntity {
  @Column({ type: 'text', enum: TaskStatus })
  status!: TaskStatus;
}

// dto/task-response.dto.ts
import { TaskStatus } from '../enums';

export class TaskResponseDto {
  @ApiProperty({ enum: TaskStatus })
  status!: TaskStatus;
}
```

## Benefits

### 1. Layer Independence
- Enums are first-class domain concepts
- Can be imported by any layer without coupling
- Entity, DTO, and service layers all import from the same source

### 2. OpenAPI/Swagger Integration
- Enums are properly documented in OpenAPI spec
- Frontend can generate type-safe clients
- API consumers get autocomplete and validation

### 3. Future Frontend Sharing
- Enums can be easily exported to shared packages
- Frontend can import the same enum definitions
- Consistency between backend validation and frontend UI

### 4. Maintainability
- Single source of truth for each enum
- Easy to locate and modify enum definitions
- Clear intent and purpose

## Current Enums

### Taskeroo Module

#### TaskStatus
**File**: [`apps/backend/src/taskeroo/enums/task-status.enum.ts`](../../apps/backend/src/taskeroo/enums/task-status.enum.ts)

Represents the lifecycle states of a task.

```typescript
export enum TaskStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  FOR_REVIEW = 'FOR_REVIEW',
  DONE = 'DONE',
}
```

**Used in**:
- `TaskEntity` - Database column type
- `TaskResponseDto` - API response documentation
- `TaskChangeStatusDto` - Input validation
- `TaskerooService` - Business logic

## Best Practices

### ✅ DO

1. **Define enums in dedicated enum files**
   ```typescript
   // enums/status.enum.ts
   export enum Status {
     ACTIVE = 'ACTIVE',
     INACTIVE = 'INACTIVE',
   }
   ```

2. **Use barrel exports for convenience**
   ```typescript
   // enums/index.ts
   export { Status } from './status.enum';
   export { Priority } from './priority.enum';
   ```

3. **Import from enums directory**
   ```typescript
   // Anywhere in the module
   import { TaskStatus } from '../enums';
   import { TaskStatus } from './enums';
   ```

4. **Document enum purpose**
   ```typescript
   /**
    * Task status enum
    *
    * Represents the lifecycle states of a task.
    * Used across entities, DTOs, and services.
    */
   export enum TaskStatus {
     // ...
   }
   ```

5. **Use string enums for API compatibility**
   ```typescript
   // ✅ Good - string values
   export enum Status {
     ACTIVE = 'ACTIVE',
     INACTIVE = 'INACTIVE',
   }

   // ❌ Bad - numeric values don't serialize well in JSON
   export enum Status {
     ACTIVE,
     INACTIVE,
   }
   ```

### ❌ DON'T

1. **Don't define enums in entity files**
   ```typescript
   // ❌ BAD
   // task.entity.ts
   export enum TaskStatus { /* ... */ }
   ```

2. **Don't duplicate enum definitions**
   ```typescript
   // ❌ BAD - Same enum defined in multiple places
   // entity.ts
   export enum Status { ACTIVE = 'ACTIVE' }

   // dto.ts
   export enum Status { ACTIVE = 'ACTIVE' }
   ```

3. **Don't use const enums** (unless for internal-only usage)
   ```typescript
   // ❌ BAD - Doesn't work well with module boundaries
   export const enum Status {
     ACTIVE = 'ACTIVE',
   }
   ```

## Future: Shared Package Export

When enums need to be shared with the frontend, they can be exported through the shared package:

```typescript
// apps/backend/src/taskeroo/enums/index.ts
export { TaskStatus } from './task-status.enum';

// packages/shared/src/enums/taskeroo.ts
export { TaskStatus } from '../../../apps/backend/src/taskeroo/enums';

// Frontend can then import:
import { TaskStatus } from 'shared/enums/taskeroo';
```

**Note**: Currently, enums are available via OpenAPI-generated types in the shared package. Direct enum sharing can be implemented when needed.

## OpenAPI Generation

Enums are automatically included in the OpenAPI specification:

```json
{
  "components": {
    "schemas": {
      "TaskResponseDto": {
        "properties": {
          "status": {
            "type": "string",
            "enum": ["NOT_STARTED", "IN_PROGRESS", "FOR_REVIEW", "DONE"]
          }
        }
      }
    }
  }
}
```

This enables:
- Type-safe client generation
- API documentation
- Input validation
- Frontend autocomplete

## Migration Guide

If you find an enum defined in an entity file:

1. **Create enum file**
   ```bash
   # Create enums directory if it doesn't exist
   mkdir -p src/module/enums

   # Create enum file
   touch src/module/enums/your-enum.enum.ts
   ```

2. **Move enum definition**
   ```typescript
   // enums/your-enum.enum.ts
   export enum YourEnum {
     VALUE_1 = 'VALUE_1',
     VALUE_2 = 'VALUE_2',
   }
   ```

3. **Create barrel export**
   ```typescript
   // enums/index.ts
   export { YourEnum } from './your-enum.enum';
   ```

4. **Update imports**
   ```typescript
   // entity.ts
   - import { YourEnum } from './entity';
   + import { YourEnum } from './enums';

   // dto/*.ts
   - import { YourEnum } from '../entity';
   + import { YourEnum } from '../enums';

   // service.ts
   - import { Entity, YourEnum } from './entity';
   + import { Entity } from './entity';
   + import { YourEnum } from './enums';
   ```

5. **Remove from entity file**
   ```typescript
   // entity.ts
   - export enum YourEnum { /* ... */ }
   ```

6. **Build and test**
   ```bash
   npm run build:prod
   ```

## Verification Checklist

When reviewing enum management:

- [ ] Enums are in dedicated `enums/` directory
- [ ] Each enum has its own file (`*.enum.ts`)
- [ ] Barrel export exists (`enums/index.ts`)
- [ ] No enums defined in entity files
- [ ] All imports reference `enums/` directory
- [ ] Enums use string values for JSON compatibility
- [ ] Enums are documented with JSDoc comments
- [ ] OpenAPI spec includes enum values
- [ ] Build passes after changes

## Status

### ✅ Compliant Modules
- `taskeroo` - TaskStatus enum properly centralized

### 📝 Future Enhancements
- Add more enums as domain needs them
- Consider shared package export when frontend needs direct access
- Evaluate enum validation at API boundary
