# Thread Parent Task ID - Test Plan

## Overview
This document outlines the comprehensive test strategy for the `parentTaskId` column addition to the `ThreadEntity`. The tests validate that threads always have a parent task, the foreign key constraint works correctly, and all edge cases are handled properly.

---

## Test Categories

### 1. Thread Creation Tests

#### 1.1. Successful Thread Creation with Parent Task
**Test:** Create a thread with a valid parent task ID
**Expected Behavior:** Thread is created successfully with `parentTaskId` set
**Justification:** This is the happy path - validates that the core functionality works when all inputs are valid.

#### 1.2. Thread Creation Fails Without Parent Task ID
**Test:** Attempt to create a thread without providing `parentTaskId`
**Expected Behavior:** Validation error or type error (depending on test level)
**Justification:** Validates that `parentTaskId` is truly required at the type/validation level.

#### 1.3. Thread Creation Fails with Non-Existent Parent Task
**Test:** Attempt to create a thread with a UUID that doesn't correspond to any existing task
**Expected Behavior:** Service throws `TaskNotFoundForThreadError`
**Justification:** Ensures data integrity - threads cannot reference non-existent tasks.

#### 1.4. Parent Task is Automatically Added to Thread's Tasks Relation
**Test:** Create a thread with `parentTaskId` and verify parent task appears in `thread.tasks`
**Expected Behavior:** Parent task is included in tasks array even if not explicitly in `taskIds`
**Justification:** Validates requirement that parent task must be in the thread's tasks relation.

#### 1.5. Parent Task Not Duplicated When Also in taskIds
**Test:** Create a thread with `parentTaskId` also explicitly included in `taskIds` array
**Expected Behavior:** Parent task appears only once in `thread.tasks` array
**Justification:** Validates that the Set-based deduplication works correctly.

---

### 2. Foreign Key Constraint Tests

#### 2.1. Cannot Delete Parent Task While Thread Exists
**Test:** Create a thread, then attempt to delete its parent task
**Expected Behavior:** Delete operation fails with FK constraint violation error
**Justification:** Validates the ON DELETE RESTRICT constraint - critical for data integrity.

#### 2.2. Can Delete Thread Without Affecting Parent Task
**Test:** Create a thread, then delete the thread
**Expected Behavior:** Thread is soft-deleted successfully, parent task remains unchanged
**Justification:** Validates that thread deletion is independent and doesn't cascade to parent task.

#### 2.3. Can Delete Parent Task After Thread is Deleted
**Test:** Create thread, soft-delete thread, then delete parent task
**Expected Behavior:** Both deletions succeed
**Justification:** Validates that soft-deleted threads don't block task deletion (important for cleanup).

---

### 3. Thread Retrieval Tests

#### 3.1. Get Thread Returns Correct parentTaskId
**Test:** Create a thread and retrieve it via `getThreadById`
**Expected Behavior:** Retrieved thread has correct non-null `parentTaskId`
**Justification:** Validates that `parentTaskId` is persisted and retrieved correctly.

#### 3.2. Thread Response DTO Contains parentTaskId
**Test:** Create a thread and check the HTTP response DTO
**Expected Behavior:** Response DTO contains non-null `parentTaskId` field
**Justification:** Validates end-to-end mapping from entity → service → controller → DTO.

#### 3.3. Find Thread by Task ID Still Works
**Test:** Create a thread and use `findThreadByTaskId` with the parent task ID
**Expected Behavior:** Thread is found successfully
**Justification:** Validates that existing query functionality continues to work with the new column.

---

### 4. Migration Tests

#### 4.4. Migration Runs Successfully on Empty Database
**Test:** Run migration on fresh database
**Expected Behavior:** Migration completes without errors, table schema is correct
**Justification:** Validates migration works in greenfield scenarios.

#### 4.5. Migration Handles Existing Empty Threads Table
**Test:** Run migration on database with threads table but no data
**Expected Behavior:** Migration completes, old data is not carried over (hard cleanup)
**Justification:** Validates that the migration's hard cleanup strategy works as intended.

---

### 5. Edge Cases & Integration Tests

#### 5.1. Multiple Threads Can Share Same Parent Task
**Test:** Create two threads with the same `parentTaskId`
**Expected Behavior:** Both threads created successfully
**Justification:** Validates that the FK is not unique - multiple threads can belong to the same parent task.

#### 5.2. Thread with Soft-Deleted Parent Task
**Test:** Soft-delete a task, then attempt to create a thread with it as parent
**Expected Behavior:** Thread creation fails (soft-deleted tasks shouldn't be usable)
**Justification:** Validates that business logic respects soft-delete semantics.

#### 5.3. Attaching Additional Tasks to Thread Doesn't Change Parent
**Test:** Create thread, attach additional tasks via `attachTask`, verify parentTaskId unchanged
**Expected Behavior:** `parentTaskId` remains the same, new tasks are added to tasks relation
**Justification:** Validates that `parentTaskId` is immutable after creation.

---

## Test Implementation Notes

- **Unit Tests:** Service layer tests with mocked repositories
- **Integration Tests:** Full database tests with real SQLite database
- **E2E Tests:** HTTP endpoint tests validating full request/response cycle
- **Migration Tests:** Test migration up/down with various database states

---

## Success Criteria

All tests must pass with:
- ✅ Proper error handling and error types
- ✅ No data integrity violations
- ✅ Correct FK constraint behavior
- ✅ Type safety maintained across all layers
- ✅ Backward compatibility where applicable (except for hard cleanup requirement)
