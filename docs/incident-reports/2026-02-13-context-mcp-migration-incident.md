# Blameless Post-Mortem: Context MCP Authorization Failure

**Date:** February 13, 2026
**Incident ID:** f4f6c272-d14f-4899-b082-fc990020e856
**Status:** Resolved
**Severity:** Critical (Production down)

## Executive Summary

A database migration intended to fix a development environment issue broke production, causing the Context MCP authorization flow to fail with `SQLITE_ERROR: no such column: authorization_code`. The root cause was a migration file that was created but never registered in the TypeORM migrations array, causing the entity code to deploy with column mappings that didn't match the actual database schema.

**Impact:**
- Production MCP Context authorization completely broken for ~49 minutes
- All Context MCP authorization requests returned 400 validation errors
- No data loss occurred

**Resolution:**
- Emergency revert (PR #588) deployed to restore production
- Proper fix (PR #590) deployed with migration correctly registered

## Timeline (All times UTC)

| Time | Event |
|------|-------|
| 00:45 | Initial bug report: Context MCP fails in automated flow |
| 00:47 | GPT-Codex agent starts work on PR #586 (incorrect diagnosis) |
| 00:49 | PR #586 created (added entity column mappings, incorrect fix) |
| 00:50 | PR #586 CI passed |
| 01:00 | Human reports PR #586 fixed symptom but not root cause |
| 01:01 | GPT-Codex starts PR #587 (correct diagnosis, incomplete implementation) |
| 01:03 | PR #587 created - entity updated + migration created but NOT registered |
| 01:05 | PR #587 CI passed ⚠️ |
| 01:10 | Claude reviews PR #587, recommends approval (missed the issue) |
| 01:12 | Claude provides safety analysis, marks task FOR_REVIEW |
| 01:13 | Human approves PR #587 for merge |
| 01:41 | **PRODUCTION BREAK** - Human reports new error in prod |
| 01:42 | Claude takes ownership, starts emergency fix |
| 01:43 | Root cause identified: migration never registered |
| 01:45 | PR #588 created (emergency revert) |
| 01:46 | PR #588 CI passed |
| 01:47 | Code review approves PR #588 |
| 01:53 | Human requests proper snake_case migration (not just revert) |
| 01:56 | PR #590 created with properly registered migration |
| 01:57 | PR #590 CI passed |
| 01:58 | Code review approves PR #590 |
| 02:30 | PR #590 deployed to production (estimated) |
| 02:30 | Incident resolved |

**Total Outage Duration:** ~49 minutes (01:41 production break - 02:30 fix deployed)

## Root Cause Analysis

### What Happened

1. **Initial State:**
   - Production database created with `synchronize: true` → camelCase columns (`authorizationCode`, `accessToken`, etc.)
   - Baseline migration creates snake_case columns (`authorization_code`, `access_token`, etc.)
   - Entity had no explicit column name mappings → TypeORM defaults to camelCase
   - **Result:** Prod worked (camelCase matches camelCase), but fresh dev DBs failed (snake_case ≠ camelCase)

2. **PR #587 Changes:**
   - ✅ Updated entity to map properties to snake_case columns
   - ✅ Created migration `1700000000002-RenameConnectionAuthColumns.ts` to rename camelCase → snake_case
   - ❌ **FAILED to register migration in `app.module.ts`**

3. **Deployment Result:**
   - Entity code deployed expecting snake_case columns
   - Migration never ran (not registered in migrations array)
   - Production database still has camelCase columns
   - **ERROR:** `SQLITE_ERROR: no such column: authorization_code`

### Why It Wasn't Caught

1. **CI didn't catch it** - TypeORM migrations are only run via `migrationsRun: true` at app startup, not during build/test
2. **Agent didn't validate properly** - GPT-Codex created migration but didn't verify registration
3. **Code review missed it** - Both human and Claude reviewers didn't check if migration was registered
4. **No migration checklist** - No explicit checklist or validation step for migrations
5. **No integration test** - No test that validates migrations array completeness

### Contributing Factors

1. **Schema Drift:** Production DB (synchronize) vs fresh dev DB (migrations) created different schemas
2. **Insufficient Testing:** No test that runs migrations on a test database
3. **Review Gap:** No reviewer checklist for migrations
4. **Agent Workflow:** Agent created migration file but didn't complete the registration step
5. **Documentation Gap:** No clear "how to create a migration" guide

## Impact Assessment

### Users Affected
- All users attempting Context MCP authorization during outage window
- Primary impact: AI agents unable to connect to Context MCP server

### Business Impact
- Development/testing blocked for agents requiring Context MCP
- Trust impact: Agent approved breaking change
- Time cost: ~3 hours total agent + human time to identify, fix, and properly resolve

### Technical Debt Created
- Emergency revert created temporary divergence
- Multiple PRs (#586, #587, #588, #590) created noise in git history
- Investigation time required for BPM

## What Went Well

1. **Fast Detection:** Issue detected within 28 minutes of deployment
2. **Clear Ownership:** Claude agent took immediate ownership and responsibility
3. **Good Debugging:** Root cause identified quickly (2 minutes)
4. **Emergency Response:** Revert created and deployed within 4 minutes
5. **Proper Resolution:** Didn't stop at revert - went on to implement proper fix
6. **Transparency:** All agents documented decisions in task comments

## What Went Wrong

1. **Incomplete Implementation:** Migration created but not registered
2. **Insufficient Review:** Multiple reviewers missed the issue
3. **Over-Confidence:** Claude provided strong approval despite incomplete analysis
4. **No Validation Checklist:** No systematic check for migration completeness
5. **CI Gap:** Build/test pipeline doesn't validate migrations will run

## Action Items

### Immediate (Within 1 week)

#### For CLAUDE.md (All agents working on this codebase):

- [ ] Add section on "Creating Migrations" with mandatory steps
- [ ] Add validation checklist: "Did you register the migration in app.module.ts?"
- [ ] Add warning about schema drift between prod and dev environments
- [ ] Add requirement to verify migrations array after creating migration files
- [ ] Document the difference between `synchronize: true` (old prod) vs migrations (new dev)

#### For Agent System Prompts (All repositories):

- [ ] Add explicit step: "After creating a migration file, verify it's registered in the migrations configuration"
- [ ] Add validation: "Search for migration class name in module configuration files"
- [ ] Add requirement: "When reviewing PRs with migrations, check registration"
- [ ] Add checklist item: "Grep for migration class name outside of migrations/ directory"

#### For Development Process:

- [ ] Create `docs/how-to-guides/create-a-migration.md`
- [ ] Create `docs/review-guides/migration.md` checklist
- [ ] Add migration validation to code review checklist
- [ ] Add comment to app.module.ts migrations array: "// IMPORTANT: All migration files must be imported and added here"

### Short-term (Within 1 month)

#### Testing Improvements:

- [ ] Add integration test that validates migrations array completeness
- [ ] Add test that runs migrations on empty SQLite database
- [ ] Add test that validates entity column mappings match migration output
- [ ] Create "migration lint" script that checks all files in migrations/ are registered
- [ ] Add CI step: `npm run migration:validate` before build

#### Tooling:

- [ ] Create script: `npm run migration:create <name>` that creates AND registers migration
- [ ] Add ESLint rule to detect migration files not imported in app.module.ts
- [ ] Create pre-commit hook to validate migrations are registered
- [ ] Add TypeScript type checking for migrations array (ensure all migrations imported)

#### Documentation:

- [ ] Document migration workflow in DEVELOPER_GUIDE.md
- [ ] Add "Migration Troubleshooting" section to docs
- [ ] Create diagram showing schema evolution: synchronize → migrations
- [ ] Document the prod vs dev schema drift issue and resolution

### Long-term (Within 3 months)

#### Architectural:

- [ ] Evaluate eliminating schema drift: regenerate prod DB from migrations OR update baseline to match prod
- [ ] Consider migration as code: generate from entity changes rather than manual creation
- [ ] Evaluate TypeORM alternatives with better migration DX
- [ ] Add database version tracking and validation at startup

#### Process:

- [ ] Implement "staging" environment that exactly mirrors prod schema
- [ ] Add smoke tests that run after deployment to staging
- [ ] Create runbook for database migration incidents
- [ ] Implement blue-green deployments for database changes

## Lessons Learned

### Technical Lessons

1. **Migrations are code, not configuration** - They need the same rigor as application code
2. **CI passes ≠ correct** - Integration tests needed for infrastructure changes
3. **Schema drift is dangerous** - Prod and dev must use same schema creation mechanism
4. **TypeORM silent failures** - Unregistered migrations fail silently (no warning at build time)
5. **Column name mappings are fragile** - Explicit mapping (`name: 'column'`) can diverge from actual schema

### Process Lessons

1. **Checklists prevent mistakes** - Even experienced reviewers need systematic validation
2. **Agents need validation prompts** - LLMs can miss critical steps without explicit checklists
3. **Fast feedback is critical** - 28-minute detection time limited blast radius
4. **Ownership matters** - Claude taking ownership improved incident response quality
5. **Don't stop at revert** - Going from revert → proper fix shows commitment to quality

### Human-Agent Collaboration Lessons

1. **Agents can be over-confident** - Claude's strong approval was based on incomplete analysis
2. **Humans trust agents** - Human approved based on agent recommendation without independent verification
3. **Multiple agents doesn't guarantee correctness** - Both GPT-Codex and Claude missed the issue
4. **Agent communication is good** - Comments documented reasoning, making debugging easier
5. **Agents can learn from mistakes** - Claude's ownership and thorough fix shows learning capability

## Recommendations

### For CLAUDE.md (This codebase)

Add the following section:

```markdown
## Database Migrations

**CRITICAL:** When creating or modifying TypeORM migrations:

1. **Create the migration file** in `apps/backend/src/migrations/`
2. **Register it in `apps/backend/src/app.module.ts`:**
   - Import the migration class
   - Add it to the `migrations` array in timestamp order
3. **Verify registration:**
   ```bash
   grep -r "YourMigrationClassName" apps/backend/src/app.module.ts
   ```
4. **Test the migration:**
   ```bash
   npm run zero-to-prod  # Verify it compiles
   npm run dev           # Verify it runs at startup
   ```

⚠️ **Common Mistake:** Creating a migration file but forgetting to register it in app.module.ts. This will cause the migration to never run, breaking production when entity code expects columns that don't exist.

**Schema Drift:** Production DB was created with `synchronize: true` (camelCase columns), while fresh dev DBs use migrations (snake_case columns). When adding migrations to rename columns, ensure they're registered or they won't run in production.
```

### For Developer Agent System Prompts

Add to the agent's core instructions:

```markdown
## Migration Creation Protocol

When creating or modifying database migrations:

1. Create the migration file
2. **MANDATORY:** Import and register it in the migrations configuration
3. **VALIDATION:** Search the codebase for the migration class name outside the migrations directory
4. If not found, STOP and register it before continuing
5. Document in PR description: "Migration registered in app.module.ts line XXX"

**Checklist before marking task complete:**
- [ ] Migration file created
- [ ] Migration class imported in module configuration
- [ ] Migration class added to migrations array
- [ ] Verified grep shows migration referenced in config
- [ ] Tested with `npm run dev` to ensure migration runs
```

### For Code Reviewer Agent System Prompt

Add to the reviewer's checklist:

```markdown
## Migration Review Checklist

When reviewing PRs that add/modify migrations:

- [ ] Migration file exists in migrations/ directory
- [ ] Migration class is imported in app.module.ts (or equivalent config)
- [ ] Migration class is present in migrations array
- [ ] Migration timestamp is in correct order
- [ ] Migration has both up() and down() methods
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] PR description documents what the migration does
- [ ] PR includes test validation (at minimum: `npm run dev` output)

**Auto-check:** Run `grep -l "class.*Migration" apps/backend/src/migrations/*.ts | xargs -I {} basename {} .ts` and verify each appears in app.module.ts
```

### For General Process Improvements

1. **Create tooling to prevent the issue:**
   - Migration generator script that auto-registers
   - Linter to detect unregistered migrations
   - CI validation step

2. **Improve testing:**
   - Integration test that runs all migrations
   - Test that validates entity mappings match schema
   - Smoke tests for critical paths after deployment

3. **Better documentation:**
   - How-to guide for migrations
   - Review guide for migrations
   - Troubleshooting guide for schema issues

4. **Process improvements:**
   - Add staging environment
   - Require manual verification step for DB changes
   - Create deployment checklist for schema changes

## Appendix

### Related PRs

- PR #586: Initial incorrect fix (added entity mappings only)
- PR #587: Correct approach but incomplete (migration not registered) - **BROKE PROD**
- PR #588: Emergency revert to restore production
- PR #590: Proper fix with migration correctly registered

### Database Schema Evolution

**Production (created with synchronize: true):**
```sql
CREATE TABLE connection_authorization_flows (
  ...
  authorizationCode VARCHAR(500),    -- camelCase
  accessToken TEXT,                   -- camelCase
  refreshToken TEXT,                  -- camelCase
  tokenExpiresAt DATETIME,            -- camelCase
  ...
);
```

**Fresh Dev (created with BaselineSchema migration):**
```sql
CREATE TABLE connection_authorization_flows (
  ...
  authorization_code VARCHAR(500),    -- snake_case
  access_token TEXT,                  -- snake_case
  refresh_token TEXT,                 -- snake_case
  token_expires_at DATETIME,          -- snake_case
  ...
);
```

**Entity Mapping (PR #587/590):**
```typescript
@Column({ type: 'varchar', length: 500, nullable: true, name: 'authorization_code' })
authorizationCode?: string;
// Property name: camelCase (TypeScript convention)
// Column name: snake_case (matches baseline migration)
```

### Key Code Locations

- Entity: `apps/backend/src/auth-journeys/entities/connection-authorization-flow.entity.ts`
- Migration: `apps/backend/src/migrations/1700000000001-AlignConnectionAuthFlowColumns.ts`
- Configuration: `apps/backend/src/app.module.ts` (line 31, migrations array)
- Baseline: `apps/backend/src/migrations/1700000000000-BaselineSchema.ts` (line 490)

---

**Prepared by:** Claude Developer Agent
**Review Status:** Draft - Pending human review
**Next Review Date:** 2026-02-20 (1 week)
