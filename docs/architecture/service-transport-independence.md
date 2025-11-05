# Service Transport Independence

## Overview

This document describes how the service layer maintains transport independence in the backend application. Transport independence ensures that services can be used with any transport protocol (HTTP, gRPC, WebSockets, etc.) without modification.

## Current Architecture

### Transport-Agnostic Services

Services in this application follow a strict transport-agnostic design:

```
Controller (Transport Layer) → Service (Business Logic) → Repository (Data Layer)
```

1. **Controllers**: Handle transport-specific concerns (HTTP, gRPC, WebSockets)
2. **Services**: Pure business logic with no transport dependencies
3. **Repositories**: Data access with no business logic

## Transport Independence Principles

### 1. No HTTP Dependencies in Services

Services must never import or use HTTP-specific types:

```typescript
// ✅ GOOD - Transport agnostic
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class TaskerooService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
    private readonly gateway: TaskerooGateway,
  ) {}
}
```

```typescript
// ❌ BAD - Transport specific
import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { NotFoundException, BadRequestException } from '@nestjs/common';

@Injectable()
export class TaskerooService {
  async getTask(id: string) {
    const task = await this.repository.findOne({ where: { id } });
    if (!task) {
      throw new NotFoundException('Task not found'); // ❌ HTTP-specific
    }
    return task;
  }
}
```

### 2. Domain-Specific Error Classes

Instead of HTTP exceptions, services throw domain-specific errors:

```typescript
// ✅ GOOD - Domain error
export abstract class TaskerooDomainError extends Error {
  constructor(
    message: string,
    readonly code: TaskerooErrorCode,
    readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class TaskNotFoundError extends TaskerooDomainError {
  constructor(taskId: string) {
    super('Task not found.', TaskerooErrorCodes.TASK_NOT_FOUND, { taskId });
  }
}
```

These domain errors are then mapped to HTTP exceptions at the controller layer (via exception filters) or to gRPC status codes, GraphQL errors, etc., depending on the transport.

### 3. Transport-Agnostic Types

Services use plain TypeScript types without transport-specific decorators:

```typescript
// ✅ GOOD - Transport agnostic service types
export type CreateTaskInput = {
  name: string;
  description: string;
  assignee?: string;
  sessionId?: string;
};

export type TaskResult = {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  assignee: string | null;
  sessionId: string | null;
  comments: CommentResult[];
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null | undefined;
};
```

```typescript
// ❌ BAD - HTTP-specific DTO with decorators
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTaskInput {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}
```

### 4. Service Method Signatures

Service methods use transport-agnostic input and output types:

```typescript
// ✅ GOOD - Taskeroo Service
export class TaskerooService {
  async createTask(input: CreateTaskInput): Promise<TaskResult> {
    // Business logic only
  }

  async getTaskById(taskId: string): Promise<TaskResult> {
    // Business logic only
  }

  async listTasks(input: ListTasksInput): Promise<ListTasksResult> {
    // Business logic only
  }
}
```

```typescript
// ✅ GOOD - Wikiroo Service
export class WikirooService {
  async createPage(input: CreatePageInput): Promise<PageResult> {
    // Business logic only
  }

  async getPageById(pageId: string): Promise<PageResult> {
    // Business logic only
  }

  async listPages(): Promise<PageSummaryResult[]> {
    // Business logic only
  }
}
```

## Allowed Dependencies in Services

### ✅ Allowed

1. **NestJS Core Dependencies**:
   - `@Injectable()` decorator
   - `Logger` for logging
   - `@InjectRepository()` for TypeORM
   - Other dependency injection decorators

2. **TypeORM**:
   - Repository classes
   - Entity classes
   - Query builders

3. **Domain-Specific Types**:
   - Custom error classes
   - Service input/output types
   - Enums and constants
   - Entity models

4. **Other Services**:
   - Gateway services (WebSockets)
   - Other domain services
   - Utility services

### ❌ Not Allowed

1. **HTTP-Specific**:
   - `HttpException` and subclasses
   - `NotFoundException`, `BadRequestException`, etc.
   - `@Req()`, `@Res()`, `@Headers()` decorators
   - Express/Fastify request/response types

2. **Transport-Specific Decorators**:
   - `@ApiProperty()` (Swagger)
   - `@ApiResponse()` (Swagger)
   - Validation decorators (`@IsString()`, etc.)
   - Any decorator that ties to a specific transport

3. **GraphQL Decorators** (unless it's a GraphQL resolver):
   - `@Query()`, `@Mutation()`
   - `@Args()`, `@Context()`

4. **gRPC-Specific Types** (unless it's a gRPC service):
   - gRPC metadata
   - gRPC status codes

## Current Implementation Review

### Taskeroo Service

**File**: `/apps/backend/src/taskeroo/taskeroo.service.ts`

✅ **Compliant**:
- No HTTP exception imports
- Uses domain-specific errors (`TaskNotFoundError`, `InvalidStatusTransitionError`, `CommentRequiredError`)
- Service types are transport-agnostic (no decorators)
- Method signatures use plain TypeScript types
- Only allowed dependencies: `@Injectable`, `Logger`, TypeORM

**Service Type Definitions**: `/apps/backend/src/taskeroo/dto/service/taskeroo.service.types.ts`
- Pure TypeScript types and interfaces
- No decorators
- Comment explicitly states: "Service layer types - transport agnostic"

**Error Definitions**: `/apps/backend/src/taskeroo/errors/taskeroo.errors.ts`
- Domain errors extend base `TaskerooDomainError`
- No HTTP status codes or exceptions
- Comment explicitly states: "Keeps HTTP concerns out of the domain layer"

### Wikiroo Service

**File**: `/apps/backend/src/wikiroo/wikiroo.service.ts`

✅ **Compliant**:
- No HTTP exception imports
- Uses domain-specific error (`PageNotFoundError`)
- Service types are transport-agnostic (no decorators)
- Method signatures use plain TypeScript types
- Only allowed dependencies: `@Injectable`, `Logger`, TypeORM

**Service Type Definitions**: `/apps/backend/src/wikiroo/dto/service/wikiroo.service.types.ts`
- Pure TypeScript interfaces
- No decorators
- Clean separation of concerns

**Error Definitions**: `/apps/backend/src/wikiroo/errors/wikiroo.errors.ts`
- Domain errors extend base `WikirooDomainError`
- No HTTP status codes or exceptions

## Benefits of Transport Independence

1. **Protocol Flexibility**: Services can be called from HTTP controllers, gRPC handlers, GraphQL resolvers, or WebSocket gateways without modification

2. **Testability**: Services can be unit tested without mocking HTTP-specific types

3. **Reusability**: Same business logic works across different transport layers

4. **Clear Separation**: Business logic is cleanly separated from transport concerns

5. **Future-Proofing**: Adding new transport protocols (e.g., gRPC) requires no service changes

6. **Error Handling**: Domain errors can be mapped to appropriate transport-specific errors at the boundary

## Error Mapping Pattern

Domain errors are mapped to transport-specific errors at the controller layer:

```typescript
// Service throws domain error
throw new TaskNotFoundError(taskId);

// Controller/Filter maps to HTTP exception
if (error instanceof TaskNotFoundError) {
  throw new NotFoundException(error.message);
}

// Or in GraphQL resolver
if (error instanceof TaskNotFoundError) {
  return new GraphQLError(error.message, {
    extensions: { code: 'TASK_NOT_FOUND' }
  });
}

// Or in gRPC handler
if (error instanceof TaskNotFoundError) {
  throw new RpcException({
    code: status.NOT_FOUND,
    message: error.message
  });
}
```

## Verification Checklist

When reviewing services for transport independence:

- [ ] No imports from HTTP exception classes
- [ ] No `@nestjs/common` exception imports (except `Injectable`, `Logger`)
- [ ] Service methods use plain TypeScript types
- [ ] Domain-specific error classes (not HTTP exceptions)
- [ ] Service input types have no decorators
- [ ] Service output types have no decorators
- [ ] No request/response objects in method signatures
- [ ] No HTTP status codes in service logic
- [ ] No Swagger decorators in service types
- [ ] No validation decorators in service types

## Current Status

### ✅ Compliant Modules

- **taskeroo**: Fully transport-agnostic
  - All service methods use transport-agnostic types
  - Domain errors only (no HTTP exceptions)
  - Clean separation of concerns

- **wikiroo**: Fully transport-agnostic
  - All service methods use transport-agnostic types
  - Domain errors only (no HTTP exceptions)
  - Clean separation of concerns

### Summary

Both services are **100% transport-independent**. No violations found.

## Best Practices

### DO ✅

1. **Use domain errors** instead of HTTP exceptions
2. **Define service types** without decorators
3. **Keep business logic** separate from transport concerns
4. **Use plain TypeScript** types and interfaces
5. **Log using Logger** instead of returning HTTP-specific messages

### DON'T ❌

1. **Don't import HTTP exceptions** in services
2. **Don't use transport-specific decorators** in service types
3. **Don't couple business logic** to HTTP status codes
4. **Don't accept/return** request/response objects
5. **Don't add Swagger/validation** decorators to service types

## Related Documentation

- [DTO Mapping Patterns](./dto-mapping-patterns.md) - How controllers map between service types and transport-specific DTOs
- [Enum Management](./enum-management.md) - How enums are used across layers
