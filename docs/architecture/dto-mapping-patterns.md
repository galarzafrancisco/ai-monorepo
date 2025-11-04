# DTO Mapping Patterns

## Overview

This document describes the DTO mapping patterns used in the backend controllers to ensure proper separation of concerns and prevent entity leakage.

## Current Architecture

### Three-Layer Separation

```
Entity (Database) → Service Result Type → Response DTO (HTTP)
```

1. **Entity Layer**: TypeORM entities with database-specific decorators
2. **Service Result Types**: Transport-agnostic types returned by services
3. **Response DTOs**: HTTP-specific types with Swagger documentation

### Mapping Flow

#### Taskeroo Module Example

```typescript
// 1. Service maps Entity → Service Result Type
private mapTaskToResult(task: TaskEntity): TaskResult {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    status: task.status,
    assignee: task.assignee,
    sessionId: task.sessionId,
    comments: task.comments.map((c) => this.mapCommentToResult(c)),
    rowVersion: task.rowVersion,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: task.deletedAt,
  };
}

// 2. Controller maps Service Result Type → Response DTO
private mapResultToResponse(result: TaskResult): TaskResponseDto {
  return {
    id: result.id,
    name: result.name,
    description: result.description,
    status: result.status,
    assignee: result.assignee ?? '',
    sessionId: result.sessionId ?? '',
    comments: result.comments.map((c) => this.mapCommentResultToResponse(c)),
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
```

#### Wikiroo Module Example

```typescript
// 1. Service maps Entity → Service Result Type
private mapToResult(page: WikiPageEntity): PageResult {
  return {
    id: page.id,
    title: page.title,
    content: page.content,
    author: page.author,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt,
  };
}

// 2. Controller maps Service Result Type → Response DTO
private mapToResponse(result: PageResult): PageResponseDto {
  return {
    id: result.id,
    title: result.title,
    content: result.content,
    author: result.author,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
  };
}
```

## Best Practices

### ✅ DO

1. **Always use explicit mapping functions** in controllers
   - Never return service results directly
   - Never return entities directly

2. **Define service result types** separate from DTOs
   - Place in `dto/service/*.service.types.ts`
   - Use `type` for simple structures, `interface` for extensibility
   - No decorators (no Swagger, no class-validator)

3. **Map at the controller layer**
   - Controller receives service result types
   - Controller returns response DTOs
   - Explicit field-by-field mapping

4. **Handle nullable fields explicitly**
   - Convert `null` to empty string if API contract requires it
   - Example: `assignee: result.assignee ?? ''`

5. **Transform data types as needed**
   - Convert `Date` to `string` (ISO format)
   - Example: `createdAt: result.createdAt.toISOString()`

### ❌ DON'T

1. **Don't return entities from services**
   ```typescript
   // ❌ BAD
   async getTask(id: string): Promise<TaskEntity> {
     return this.repository.findOne({ where: { id } });
   }
   ```

2. **Don't return service results from controllers**
   ```typescript
   // ❌ BAD
   @Get(':id')
   async getTask(@Param('id') id: string): Promise<TaskResult> {
     return this.service.getTask(id);
   }
   ```

3. **Don't mix concerns**
   ```typescript
   // ❌ BAD - Entity with Swagger decorators
   @Entity()
   export class TaskEntity {
     @ApiProperty()
     @PrimaryGeneratedColumn()
     id: string;
   }
   ```

## Intentional Data Hiding

Some service result types may include fields that are NOT exposed in response DTOs:

### Example: rowVersion and deletedAt

```typescript
// Service Result Type includes internal fields
export type TaskResult = {
  id: string;
  name: string;
  // ... other fields ...
  rowVersion: number;        // ⚠️ Not exposed in DTO
  deletedAt: Date | null;    // ⚠️ Not exposed in DTO
};

// Response DTO only exposes public fields
export class TaskResponseDto {
  id!: string;
  name!: string;
  // ... other fields ...
  // rowVersion and deletedAt are intentionally excluded
}
```

**Rationale**: Internal database fields like version numbers and soft-delete timestamps are useful for service layer logic (e.g., optimistic locking, filtering) but should not be exposed via the API.

## Benefits of This Pattern

1. **Transport Independence**: Services can be reused with GraphQL, gRPC, or other protocols
2. **Clear Contracts**: Each layer has explicit type definitions
3. **Data Hiding**: Internal fields can be excluded from public APIs
4. **Type Safety**: TypeScript ensures correct mapping at compile time
5. **Maintainability**: Changes to entities don't automatically leak to API
6. **Documentation**: Swagger decorators only on DTOs, keeping concerns separated

## Verification Checklist

When reviewing DTO mapping in controllers:

- [ ] Controller has private mapping functions (not just returning service results)
- [ ] Service returns typed result objects (not entities)
- [ ] Response DTOs have Swagger decorators
- [ ] Service result types have NO decorators
- [ ] All fields are explicitly mapped (no spreading)
- [ ] Date objects are converted to ISO strings
- [ ] Nullable fields are handled explicitly
- [ ] No entity types used in controller signatures

## Migration Guide

If you find a controller that violates these patterns:

1. Create service result types in `dto/service/*.service.types.ts`
2. Add mapping functions to the service (`mapEntityToResult`)
3. Update service return types to use result types
4. Add mapping functions to the controller (`mapResultToResponse`)
5. Update controller method signatures to return response DTOs

## Current Status

### ✅ Compliant Modules
- `taskeroo` - Full three-layer separation with explicit mapping
- `wikiroo` - Full three-layer separation with explicit mapping

### 📝 Notes
- Both modules follow best practices consistently
- No entity-to-DTO leakage detected
- Intentional data hiding is properly implemented
