# Real-Time Events Guide

This guide explains how we implement real-time behavior in Taico using domain events + Socket.io gateways, while keeping REST as the source of truth.

## Core Principle

WebSocket events are for responsiveness and human feedback, not authoritative state transfer.

- UI state must be reconstructable from REST alone.
- Refreshing the page must recover all required data.
- Missing a WebSocket event should not corrupt state; at worst it delays visual updates until the next REST fetch.

## Backend Pattern

### 1) Emit domain events from services

Services emit internal Symbol-based events after successful writes.

- Keep this transport-agnostic.
- Do not emit wire event names from service code.

Reference:
- `apps/backend/src/threads/events/threads.events.ts`
- `apps/backend/src/threads/threads.service.ts`

### 2) Map domain events to wire events in a gateway

Gateways are transport adapters:

- Listen to internal domain events (`@OnEvent(...)`).
- Convert entities to DTOs.
- Emit stable wire events for clients.

Reference:
- `apps/backend/src/threads/threads.gateway.ts`
- `apps/backend/src/tasks/tasks.gateway.ts`
- `apps/backend/src/context/context.gateway.ts`

## Room Topology

Use room scopes to control fanout and payload relevance.

- **Entity collection room**: list-level updates (e.g. `threads`, `tasks`).
- **Entity instance room**: detailed updates for one entity (e.g. `threads-<threadId>`).

Threads are the reference implementation:

- Subscribe without `threadId` -> joins `threads` room.
- Subscribe with `threadId` -> joins `threads-<threadId>` room.
- Thread title updates emit to both list and detail rooms.

Reference:
- `apps/backend/src/threads/threads.gateway.ts`

## Frontend Pattern

### 1) Load state via REST first

- Thread/task/context lists and details are fetched through REST APIs.
- WebSocket listeners should layer on top of that baseline.

### 2) Treat wire events as incremental updates

- Use direct state updates for simple events (create/update/delete).
- Re-fetch via REST when an event implies a complex projection (for example comment-driven task updates).

Reference:
- `apps/ui2/src/features/threads/useThreads.ts`
- `apps/ui2/src/features/threads/useThreadSocket.ts`
- `apps/ui2/src/features/tasks/useTasks.ts`

## Payload Guidance

- Keep payloads focused and small.
- Avoid heavy snapshots over WebSocket.
- Use identifiers and small deltas; let clients fetch full resources via REST when needed.

Good fits:
- "message created"
- "agent thinking/tool-calling"
- "title updated"

Bad fits:
- full list snapshots as the primary sync mechanism
- large, authoritative object graphs

## Implementation Checklist for New Domains

1. Define Symbol-based domain events in `events/<domain>.events.ts`.
2. Emit those events from service methods after writes succeed.
3. Add/extend `<Domain>Gateway` to:
   - expose subscribe/unsubscribe handlers,
   - join collection and instance rooms where relevant,
   - map domain events to stable wire events.
4. In UI hooks, fetch initial state via REST before relying on websocket updates.
5. Ensure UI remains correct if websocket events are missed or delayed.
