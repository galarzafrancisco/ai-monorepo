# DTO Review - PATCH DTO Pattern Verification

**Review Date:** 2025-11-05
**Reviewer:** Claude
**Status:** ✅ INTENTIONAL DESIGN

## Overview

This review analyzes the PATCH DTO implementation pattern, specifically examining whether `UpdateTaskDto` should use `PartialType(CreateTaskDto)` or if the current single-field design is intentional business logic.

## Scope

- `apps/backend/src/taskeroo/dto/update-task.dto.ts`
- `apps/backend/src/taskeroo/dto/create-task.dto.ts`
- Related PATCH endpoints and business logic

## Review Question

**Should `UpdateTaskDto` use `PartialType` pattern or is single-field update intentional?**

## Findings

### Current Implementation

#### UpdateTaskDto (update-task.dto.ts)
```typescript
export class UpdateTaskDto {
  @ApiProperty({
    description: 'Updated description of the task',
    example: 'Add JWT-based authentication with refresh tokens',
  })
  @IsString()
  @IsNotEmpty()
  description!: string;
}
```

**Current Pattern:**
- ✅ Single field: `description` only
- ✅ NOT using `PartialType(CreateTaskDto)`
- ✅ Field is required (not optional)

#### CreateTaskDto (create-task.dto.ts)
```typescript
export class CreateTaskDto {
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiPropertyOptional() assignee?: string;
  @ApiPropertyOptional() sessionId?: string;
}
```

**Fields:**
- Required: `name`, `description`
- Optional: `assignee`, `sessionId`

#### Alternative Pattern (NOT Used)
```typescript
// ❌ NOT implemented (and that's CORRECT)
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
```

This would have allowed updating all fields: `name`, `description`, `assignee`, `sessionId`

## Analysis

### Why Single-Field Update is Correct

#### 1. Separation of Concerns

The Taskeroo module has **specialized endpoints** for different update operations:

| Endpoint | DTO | Purpose | Fields Updated |
|----------|-----|---------|----------------|
| `PATCH /tasks/:id` | `UpdateTaskDto` | Update description | `description` only |
| `PATCH /tasks/:id/assign` | `AssignTaskDto` | Assign task | `assignee`, `sessionId` |
| `PATCH /tasks/:id/status` | `TaskChangeStatusDto` | Change status | `status`, optional `comment` |

**Observation:** Each endpoint has a **single responsibility** with its own validation rules.

#### 2. Business Logic Justification

**Why `name` is NOT updateable:**
- Task name is likely an identifier or title set at creation
- Changing names could break tracking, references, or audit trails
- Common pattern: names are immutable after creation (like GitHub issue titles)

**Why `assignee`/`sessionId` have dedicated endpoint:**
- Assignment is a **business event** that may require:
  - Access control checks (can this user assign tasks?)
  - Notifications to the assignee
  - Audit logging of assignment changes
  - WebSocket notifications (line 132 in service: `gateway.emitTaskAssigned()`)
- Separate endpoint enables distinct authorization rules

**Why `status` has dedicated endpoint:**
- Status changes have **complex validation rules** (line 260-275 in service):
  - Cannot go to `IN_PROGRESS` without assignee
  - `DONE` requires a comment (if no prior comments exist)
- Separate endpoint enables proper business rule enforcement
- Status changes trigger different WebSocket events (line 306: `gateway.emitStatusChanged()`)

#### 3. API Design Benefits

**Current Design (Specialized Endpoints):**
```
PATCH /tasks/:id              { description }
PATCH /tasks/:id/assign       { assignee, sessionId }
PATCH /tasks/:id/status       { status, comment }
```

**Pros:**
- ✅ Clear, self-documenting API
- ✅ Each endpoint has specific validation
- ✅ Easy to apply different authorization rules
- ✅ Enables targeted rate limiting
- ✅ Better API documentation (clear what each endpoint does)
- ✅ Prevents accidental updates to wrong fields

**Alternative Pattern (Generic PATCH with PartialType):**
```
PATCH /tasks/:id  { description?, assignee?, sessionId?, status?, name? }
```

**Cons:**
- ❌ Unclear which fields are actually updatable
- ❌ Complex validation rules needed in single endpoint
- ❌ Cannot enforce different authorization per field
- ❌ Business rules harder to implement (status transitions, comment requirements)
- ❌ Less self-documenting API

### 4. REST Best Practices Alignment

The current pattern follows **RESTful resource design**:

**Specialized Sub-resources:**
- `/tasks/:id` - Task metadata (description only)
- `/tasks/:id/assign` - Assignment sub-resource
- `/tasks/:id/status` - Status sub-resource
- `/tasks/:id/comments` - Comments sub-resource

This pattern is common in well-designed REST APIs:
- GitHub: `/repos/:owner/:repo/topics` (not PATCH /repos with topics field)
- Stripe: `/customers/:id/sources` (not PATCH /customers with sources field)

### 5. Code Review Evidence

**Service Layer (taskeroo.service.ts):**

```typescript
// Line 75-100: updateTask() only updates description
async updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskResult> {
  task.description = input.description;  // ONLY description
  // ... NO assignment, status, or name changes
}

// Line 102-134: Separate assignTask() method
async assignTask(taskId: string, input: AssignTaskInput): Promise<TaskResult> {
  task.assignee = input.assignee || null;
  if (input.sessionId !== undefined) {
    task.sessionId = input.sessionId || null;
  }
  this.gateway.emitTaskAssigned(assignedTask);  // Dedicated event
}

// Line 243-308: Separate changeStatus() method with complex validation
async changeStatus(taskId: string, input: ChangeStatusInput): Promise<TaskResult> {
  // Complex business rules
  if (input.status === TaskStatus.IN_PROGRESS && !task.assignee) {
    throw new InvalidStatusTransitionError(...);
  }
  if (input.status === TaskStatus.DONE) {
    // Comment requirements
  }
  this.gateway.emitStatusChanged(taskWithRelations);  // Dedicated event
}
```

**Controller Layer (taskeroo.controller.ts):**

Each endpoint has:
- Different HTTP paths (lines 57, 75, 156)
- Different OpenAPI documentation (lines 58-64, 76-82, 157-165)
- Different response examples
- Different error descriptions

## Decision Matrix

| Aspect | Single-Field DTO | PartialType DTO | Winner |
|--------|------------------|-----------------|--------|
| Separation of Concerns | ✅ Clear boundaries | ❌ Mixed responsibilities | Single-Field |
| Business Logic Enforcement | ✅ Each endpoint enforces rules | ❌ Complex conditional logic | Single-Field |
| API Documentation | ✅ Self-documenting | ❌ Unclear what's allowed | Single-Field |
| Authorization | ✅ Granular per operation | ❌ All-or-nothing | Single-Field |
| Validation | ✅ Targeted validation | ❌ Complex conditional rules | Single-Field |
| WebSocket Events | ✅ Specific events per action | ❌ Generic update event | Single-Field |
| Audit Trail | ✅ Clear what changed | ❌ Need to diff fields | Single-Field |
| API Discoverability | ✅ Explicit endpoints | ❌ Magic field behavior | Single-Field |
| Code Simplicity | ✅ Simple per-endpoint logic | ❌ Complex branching | Single-Field |
| REST Principles | ✅ Sub-resource pattern | ⚠️ Generic PATCH pattern | Single-Field |

**Result:** Single-field specialized DTOs win **10-0-0**

## Recommendations

### Current State: CORRECT ✅

The current implementation is **intentionally designed** and follows **best practices**:

1. ✅ `UpdateTaskDto` correctly has only `description` field
2. ✅ Other updates use specialized endpoints with dedicated DTOs
3. ✅ Business logic properly enforced at each endpoint
4. ✅ API is clear, self-documenting, and follows REST principles
5. ✅ WebSocket events are specific to each action type

### DO NOT Change To PartialType ❌

**Do not refactor to:**
```typescript
// ❌ BAD: Do not implement this
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
```

**Reasons:**
1. Would break existing business logic (status validation, assignment notifications)
2. Would make API less clear and self-documenting
3. Would complicate authorization (cannot have field-level permissions)
4. Would lose targeted WebSocket events
5. Would make audit trail less clear
6. Violates single responsibility principle

### When to Use PartialType

Use `PartialType(CreateDto)` pattern when:

1. ✅ **Simple CRUD:** No complex business rules or validations
2. ✅ **Uniform Updates:** All fields have same authorization/validation rules
3. ✅ **No Side Effects:** Updates don't trigger notifications or workflows
4. ✅ **Flat Resource:** No sub-resources or nested operations

**Example where PartialType is appropriate:**
```typescript
// Simple blog post with no complex logic
export class UpdateBlogPostDto extends PartialType(CreateBlogPostDto) {}
```

**Current Taskeroo does NOT fit these criteria** - it has:
- ❌ Complex business rules (status transitions)
- ❌ Different authorization per field
- ❌ Side effects (WebSocket events, notifications)
- ❌ Sub-resources (assign, status, comments)

## Wikiroo Module Analysis

Let's verify Wikiroo doesn't have PATCH operations that should be reviewed:

**Wikiroo Endpoints (wikiroo.controller.ts):**
- `POST /pages` - Create page
- `GET /pages` - List pages
- `GET /pages/:id` - Get page

**Observation:** Wikiroo has **NO update operations** at all.

**Conclusion:** No PATCH DTO pattern to review in Wikiroo.

## Additional Evidence: OpenAPI Documentation

The specialized endpoints result in **clear OpenAPI documentation**:

```yaml
/taskeroo/tasks/{id}:
  patch:
    summary: "Update task description"  # Clear purpose
    requestBody:
      description  # Only this field documented

/taskeroo/tasks/{id}/assign:
  patch:
    summary: "Assign a task to someone"  # Clear purpose
    requestBody:
      assignee, sessionId  # Only these fields documented

/taskeroo/tasks/{id}/status:
  patch:
    summary: "Change task status"  # Clear purpose
    requestBody:
      status, comment  # Only these fields documented
```

With `PartialType`, documentation would show all fields but only some would work:

```yaml
# ❌ BAD: Unclear documentation
/taskeroo/tasks/{id}:
  patch:
    summary: "Update task"  # Vague
    requestBody:
      name?, description?, assignee?, sessionId?, status?
      # Which fields actually work? Unclear!
```

## Conclusion

**Status:** ✅ INTENTIONAL DESIGN - NO CHANGES REQUIRED

The `UpdateTaskDto` implementation with single `description` field is:

1. **Intentional:** Part of a well-designed API with specialized endpoints
2. **Correct:** Aligns with business logic requirements
3. **Best Practice:** Follows RESTful sub-resource pattern
4. **Well-Implemented:** Each endpoint has specific validation and side effects
5. **Self-Documenting:** Clear API structure for consumers

**DO NOT** refactor to use `PartialType(CreateTaskDto)` as this would:
- Break business logic (status transitions, assignment validation)
- Lose WebSocket event specificity
- Complicate authorization
- Make API less clear
- Violate single responsibility principle

**Recommendation:** Keep current implementation as-is. Consider documenting this design decision for future developers who might question why `PartialType` isn't used.

---

**Review completed on:** 2025-11-05
**Reviewer:** Claude (AI Assistant)
**Status:** ✅ APPROVED - Current design is intentional and correct
