# Scheduled Tasks Feature

## Overview

This document tracks the implementation of the scheduled/recurring tasks feature for Taico.

## Feature Description

Allow users to create task blueprints (templates) and schedules to automatically generate tasks at specified intervals (e.g., "Every Monday at 9am").

## Architecture

### Entities
- **TaskBlueprint**: Template for tasks (name, description, assignee, tags, dependencies)
- **ScheduledTask**: Links a blueprint to a cron schedule with enable/disable capability

### Backend Components
- **TaskBlueprintsService**: CRUD operations for blueprints
- **TaskSchedulerService**: Background scheduler using @nestjs/schedule to create tasks from blueprints
- **API Endpoints**: RESTful endpoints for managing blueprints and schedules

### Frontend Components
- **Blueprint Creation UI**: Similar to task creation flow
- **Schedule Configuration**: Human-friendly cron expression builder
- **Schedule View**: List and manage all scheduled tasks
- **Navigation**: Low-frequency but discoverable access to schedules

## Implementation Tasks

### Task 1: Backend Implementation
**ID**: f10e3d6d-e5f7-4101-9868-a4f2fc678dd2
**Assignee**: claude-dev
**Status**: Not Started

Deliverables:
- TaskBlueprint and ScheduledTask entities
- TaskBlueprintsService and TaskSchedulerService
- API controllers and endpoints
- DTOs following layered architecture pattern
- Database migrations

### Task 2: Frontend Implementation
**ID**: 38e4d9bf-6c84-4f77-939d-237c27d520dc
**Assignee**: TBD (after backend completion)
**Status**: Not Started
**Depends On**: Task 1

Deliverables:
- Blueprint creation modal/popover
- Schedule configuration component
- Schedule list/view pages
- Navigation integration
- Mobile and desktop responsive UI

### Task 3: Integration & Polish
**ID**: df65edbf-0f63-4b30-b3fa-ee259b52dadc
**Assignee**: TBD (after frontend completion)
**Status**: Not Started
**Depends On**: Task 2

Deliverables:
- End-to-end testing
- Error handling and edge cases
- Performance optimization
- UX polish
- Documentation

## Design Decisions

### Why Separate Entities?
- Task blueprints shouldn't appear in regular task lists
- Allows different permissions and access patterns
- Clean separation of concerns

### Scheduler Implementation
- Uses existing @nestjs/schedule library (already in project)
- Pattern established in auth-journeys-cleanup.service.ts
- Runs checks periodically (every minute) for due schedules

### UI Integration Approach
- Low-frequency feature needs to be discoverable but not intrusive
- Solution: Subtle icon/button in tasks header + mobile menu option
- Badge for active schedule count provides visibility

## Technical Debt & Future Enhancements

- **Timezone Support**: Initial implementation uses server timezone; could add per-user timezone preferences
- **Schedule History**: Track which tasks were created from which schedules
- **Advanced Cron**: Start with common patterns (daily, weekly, monthly); add advanced cron builder later
- **Bulk Operations**: Enable/disable or delete multiple schedules at once

## References

- **Existing Patterns**:
  - Task entity: `apps/backend/src/tasks/task.entity.ts`
  - Task service: `apps/backend/src/tasks/tasks.service.ts`
  - Scheduler example: `apps/backend/src/auth-journeys/auth-journeys-cleanup.service.ts`
  - UI task components: `apps/ui2/src/features/tasks/`

- **Related Documentation**:
  - `/docs/architecture/` - Architecture patterns
  - `/docs/PRIMITIVES.md` - Core Taico primitives
  - `apps/ui2/CLAUDE.md` - Frontend patterns

## Status

**Created**: 2026-02-13
**Last Updated**: 2026-02-13
**Current Phase**: Planning Complete, Backend Task Assigned
