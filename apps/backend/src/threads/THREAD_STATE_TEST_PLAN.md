# Thread State Context Block - Test Plan

## Overview
This document outlines the test strategy for the thread state context block feature. Every thread must have a dedicated state context block that tracks its evolving state.

## Test Categories

### 1. Thread Creation with State Block
**Rationale**: The state block is a required part of thread creation. We must ensure it's created automatically and properly linked.

#### 1.1. Auto-creation of State Block
- **What**: When a thread is created, a state context block should be automatically created
- **Why**: State tracking is mandatory for all threads
- **Expected**:
  - State block is created with initial content referencing parent task
  - Thread entity has `stateContextBlockId` populated
  - State block has appropriate title and tags

#### 1.2. State Block Initial Content
- **What**: Verify the initial content of the state block
- **Why**: The state should start with meaningful context about the thread's purpose
- **Expected**: Content follows format: "This thread was created to achieve task {name} (id {id})."

#### 1.3. Thread Creation Rollback on State Block Failure
- **What**: If state block creation fails, thread creation should fail
- **Why**: Threads are invalid without state blocks
- **Expected**: Thread is not created if state block creation fails

### 2. State Block Foreign Key Constraint
**Rationale**: The state block is a critical component that must not be deleted while the thread exists.

#### 2.1. Cannot Delete State Block While Thread Exists
- **What**: Attempting to delete a thread's state block should fail
- **Why**: ON DELETE RESTRICT ensures data integrity
- **Expected**: Deletion attempt throws an error due to FK constraint

#### 2.2. Deleting Thread Allows State Block Deletion
- **What**: After a thread is deleted, its state block can be deleted
- **Why**: The FK constraint should not prevent cleanup of orphaned state blocks
- **Expected**: State block can be deleted after thread is removed

### 3. Get Thread State
**Rationale**: Users need to retrieve the current state of a thread.

#### 3.1. Get State from Valid Thread
- **What**: Retrieve state content from an existing thread
- **Why**: Primary use case for reading thread state
- **Expected**: Returns the current content of the state block

#### 3.2. Get State from Non-existent Thread
- **What**: Attempt to get state from a thread that doesn't exist
- **Why**: Edge case - proper error handling
- **Expected**: Throws ThreadNotFoundError

#### 3.3. Get State When State Block is Deleted (Edge Case)
- **What**: Thread exists but state block was somehow deleted
- **Why**: Edge case - data integrity issue
- **Expected**: Throws appropriate error from ContextService

### 4. Update Thread State
**Rationale**: The state should be updateable to reflect changes in the thread's context.

#### 4.1. Replace State Content
- **What**: Update the entire state content with new text
- **Why**: Complete state replacement is a common operation
- **Expected**: State block content is replaced, returns new content

#### 4.2. Update State with Empty Content
- **What**: Attempt to update state with empty string
- **Why**: Validate input handling
- **Expected**: Should fail validation (content is required)

#### 4.3. Update State on Non-existent Thread
- **What**: Attempt to update state for non-existent thread
- **Why**: Edge case - proper error handling
- **Expected**: Throws ThreadNotFoundError

### 5. Append to Thread State
**Rationale**: Incremental updates are important for maintaining a log of state changes.

#### 5.1. Append New Content
- **What**: Append text to existing state
- **Why**: Build up state history over time
- **Expected**: New content is added to end with newline separator

#### 5.2. Append Multiple Times
- **What**: Multiple sequential appends to state
- **Why**: Common pattern for logging decisions/updates
- **Expected**: Each append adds to the cumulative content

#### 5.3. Append to Non-existent Thread
- **What**: Attempt to append state for non-existent thread
- **Why**: Edge case - proper error handling
- **Expected**: Throws ThreadNotFoundError

### 6. Thread Response DTO
**Rationale**: API responses must include the state block ID.

#### 6.1. Thread DTO Includes stateContextBlockId
- **What**: Verify DTO mapping includes state block ID
- **Why**: Clients need to know which block contains the state
- **Expected**: stateContextBlockId is present in response

### 7. Thread Deletion with State Block
**Rationale**: Thread deletion should handle the state block appropriately.

#### 7.1. Thread Deletion Succeeds
- **What**: Deleting a thread should work normally
- **Why**: State block should not prevent thread deletion
- **Expected**: Thread is soft-deleted successfully (state block remains)

#### 7.2. Multiple Threads Cannot Share State Block
- **What**: Each thread should have its own unique state block
- **Why**: State is thread-specific
- **Expected**: Two threads have different stateContextBlockIds

### 8. Integration Tests
**Rationale**: End-to-end flows validate the entire feature.

#### 8.1. Complete State Management Flow
- **What**: Create thread → get state → update state → append state → delete thread
- **Why**: Validates the entire lifecycle
- **Expected**: All operations succeed in sequence

#### 8.2. Concurrent State Updates
- **What**: Multiple updates to the same thread's state
- **Why**: Ensure thread-safety and consistency
- **Expected**: All updates are applied correctly

## Test Implementation Notes

- Use existing test patterns from threads.service.spec.ts
- Mock ContextService for unit tests
- Integration tests should use real database or in-memory DB
- Each test should be independent and not rely on other tests
- Use descriptive test names that explain what is being tested
