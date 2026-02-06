# Persistent Session Design Proposal

## Problem Statement

Currently, each agent run creates a brand new session with zero context from previous runs. While this works, agents could benefit from having access to previous conversation history, especially for:
- Multi-turn debugging within the same task
- Learning from previous attempts and failures
- Maintaining context across status changes (e.g., NOT_STARTED → IN_PROGRESS → FOR_REVIEW → IN_PROGRESS)

## Current Architecture

### Session Storage Infrastructure
- **File**: `apps/agents/src/helpers/sessionStore.ts`
- **Format**: JSON file with entries: `{ agentId, taskId, sessionId }[]`
- **Location**: `apps/agents/src/helpers/sessions.json`
- **Status**: Infrastructure exists but session resumption is **not implemented**

### Per-SDK Status

| SDK | Session Capture | Session Resumption | Persistence |
|-----|----------------|-------------------|-------------|
| **Claude** | ✅ Implemented | ❌ Commented out | File-based (`.claude/`) |
| **OpenCode** | ✅ Implemented | ❌ Not used | Server-managed |
| **ADK (Gemini)** | ❌ No-op | ❌ Not possible | In-memory only |

### Code References
- Session captured in `Coordinator.ts` line 129: `const sessionId = getSession(agent.actorId, task.id);`
- Session stored via callback in `Coordinator.ts` lines 186-190
- **Claude**: Session resume disabled in `ClaudeAgentRunner.ts` line 26: `// resume: ctx.resume,`
- **OpenCode**: New session always created in `OpenCodeAgentRunner.ts` line 71
- **ADK**: Hardcoded IDs in `ADKAgentRunner.ts` lines 27-29

## Proposed Options

### Option 1: Simple Resume (Minimal Change)
**Scope**: Enable session resumption with existing infrastructure

**Changes**:
1. **Claude**: Uncomment `resume: ctx.resume` and pass stored session ID
2. **OpenCode**: Check for existing session before creating new one, reuse if found
3. **ADK**: Keep in-memory for now (or skip this agent type)

**Pros**:
- Minimal code changes
- Works immediately for Claude (our primary agent)
- No database schema changes
- Low risk

**Cons**:
- No session metadata (created date, last used, run count)
- No cleanup mechanism - sessions accumulate forever
- Limited observability (can't see what sessions exist)
- Different behavior per agent type

**Effort**: 1-2 hours

---

### Option 2: Session Metadata Tracking (Recommended)
**Scope**: Add proper session tracking and management

**Changes**:
1. **Database**: Create `agent_sessions` table
   ```sql
   - id (uuid, PK)
   - agent_id (uuid, FK to actors)
   - task_id (uuid, FK to tasks)
   - sdk_session_id (string) -- SDK's native session ID
   - created_at (datetime)
   - last_used_at (datetime)
   - run_count (int)
   - metadata (json) -- SDK-specific data
   ```

2. **Service Layer**: Create `AgentSessionsService`
   - `getOrCreateSession(agentId, taskId)`
   - `recordSessionUse(sessionId)`
   - `listSessions(filters)`
   - `cleanupOldSessions(olderThan)`

3. **Runner Integration**:
   - Claude: Pass `resume: session.sdkSessionId`
   - OpenCode: Reuse session ID or create new if expired
   - ADK: Implement custom `DatabaseSessionService` extending `BaseSessionService`

4. **Cleanup**: Add cron job or manual command to prune old sessions

**Pros**:
- Full visibility into session lifecycle
- Proper cleanup mechanisms
- Queryable session history
- Consistent across all agent types
- Foundation for future features (session sharing, forking, etc.)

**Cons**:
- More upfront work (migration, entities, service layer)
- Database schema changes
- Need to handle migration for existing sessions

**Effort**: 4-6 hours

---

### Option 3: Hybrid Approach (Pragmatic)
**Scope**: Quick fix now, proper solution later

**Phase 1 - Immediate** (Option 1):
- Enable Claude session resumption (our main agent)
- Keep simple file-based storage
- Document limitations

**Phase 2 - When needed** (Option 2):
- Implement full session tracking when we hit limitations:
  - Session accumulation causing disk issues
  - Need to debug session state
  - Want to share sessions across runs
  - Multi-agent collaboration requires session visibility

**Pros**:
- Immediate value with minimal effort
- Deferred complexity until actually needed
- Learn from usage before over-engineering

**Cons**:
- Two rounds of changes instead of one
- May hit limitations sooner than expected
- Technical debt accrues in the meantime

**Effort**: 1-2 hours now, 4-6 hours later

---

## Additional Considerations

### Session Lifecycle Questions
1. **When should sessions be created?**
   - Per task (current approach)?
   - Per task + status? (new session on each status change)
   - Per agent run? (no persistence)

2. **When should sessions expire?**
   - After X days of inactivity?
   - When task is marked DONE?
   - Manual cleanup only?

3. **Should sessions be shared?**
   - Can multiple agents work on the same session?
   - Can sessions be forked for parallel work?

### ADK Session Persistence
If we want ADK sessions to persist, we need to implement a custom `SessionService`:

```typescript
class DatabaseSessionService extends BaseSessionService {
  async createSession(req: CreateSessionRequest): Promise<Session> {
    // Store in agent_sessions table
  }

  async getSession(req: GetSessionRequest): Promise<Session | undefined> {
    // Retrieve from database with events
  }

  // ... implement other methods
}
```

This requires:
- Storing session events (conversation history) as JSON
- Mapping ADK's session model to our database schema
- Handling event retrieval with pagination

### Workspace Folder Management
Currently: `WORK_DIR/{taskId}/{agentId}/repo/`

**Questions**:
- Should we clean up workspace folders when sessions expire?
- Should repo clones be shared across tasks in the same project?
- How do we handle disk space limits?

## Recommendation

I recommend **Option 3 (Hybrid Approach)** because:

1. **Immediate value**: Claude session resumption solves 80% of the use case with minimal effort
2. **Learn first**: We don't yet know how sessions will be used in practice
3. **Avoid over-engineering**: Don't build features we might not need
4. **Clear upgrade path**: Option 2 is well-defined when we need it

### Proposed Immediate Action (Phase 1)
1. Uncomment `resume` in `ClaudeAgentRunner.ts`
2. Pass `sessionId` from storage to runner context
3. Test that sessions persist across runs on the same task
4. Add logging to verify session reuse
5. Document limitations in code comments

### Deferred to Phase 2
- Database session tracking
- Session cleanup/expiration
- Multi-agent session coordination
- ADK persistence implementation

## Open Questions for Discussion

1. Should sessions persist across different task statuses? (e.g., should FOR_REVIEW → IN_PROGRESS reuse the same session?)
2. What's an acceptable session retention period? (30 days? Until task closed?)
3. Do we want to expose session info in the API/UI for debugging?
4. Should we track token usage or other metrics per session?
