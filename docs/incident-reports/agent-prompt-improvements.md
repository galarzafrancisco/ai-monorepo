# Agent System Prompt Improvements

**Context:** Following the February 13, 2026 Context MCP migration incident, these improvements should be added to agent system prompts to prevent similar issues across all repositories.

**Incident Reference:** See `2026-02-13-context-mcp-migration-incident.md` for full details.

## Summary of the Problem

An AI agent (GPT-Codex) created a database migration file but forgot to register it in the TypeORM configuration. The migration never ran in production, but the entity code deployed expecting columns that didn't exist, causing a 49-minute production outage.

**Root Cause:** The agent completed 95% of the work (created migration, wrote tests) but missed the final critical step (registration).

**Why It Happened:**
1. No explicit checklist for migration steps
2. No validation that migration was registered
3. CI passed (migrations don't run during build/test)
4. Human and AI reviewers both missed it

## Recommendations for Developer Agent Prompts

### 1. Add Migration Creation Protocol

**Insert into developer agent system prompt:**

```markdown
## Database Migration Protocol

When creating or modifying database migrations, follow this MANDATORY checklist:

### Step-by-Step Process

1. **Create the migration file**
   - Location: `<project-migrations-directory>` (e.g., `apps/backend/src/migrations/`)
   - Naming: `<timestamp>-<DescriptiveName>.ts`
   - Structure: Must implement `MigrationInterface` with `up()` and `down()` methods

2. **Make it idempotent**
   - Migration MUST be safe to run multiple times
   - Check if changes already exist before applying
   - Example: Check if column exists before adding it

3. **CRITICAL: Register the migration**
   - Import the migration class in the configuration file (e.g., `app.module.ts`)
   - Add it to the migrations array in timestamp order
   - **THIS IS THE MOST COMMONLY FORGOTTEN STEP**

4. **MANDATORY: Verify registration**
   - Run: `grep -r "<MigrationClassName>" <config-file-path>`
   - Expected: At least 2 results (import statement + array entry)
   - **If grep returns 0 results, STOP and register the migration**

5. **Test the migration**
   - Build: `npm run build` (or equivalent)
   - Runtime: `npm run dev` (or equivalent)
   - Verify migration appears in startup logs
   - Verify migration executes successfully

6. **Document in PR**
   - State what the migration does
   - Include line number where migration was registered
   - Include output from test run showing migration executed

### Validation Checklist

Before marking task complete or creating PR, verify:

- [ ] Migration file created
- [ ] Migration has both `up()` and `down()` methods
- [ ] Migration is idempotent (checks before creating/altering)
- [ ] Migration class imported in configuration file
- [ ] Migration class added to migrations array
- [ ] Ran grep verification (returned 2+ results)
- [ ] Tested with build command (successful)
- [ ] Tested with dev command (migration executed in logs)
- [ ] PR description includes registration line number
- [ ] PR description includes test output

### Red Flags - STOP if Any Apply

⛔ **STOP and fix if:**
- Grep verification returns 0 results → Migration not registered
- Dev logs don't show migration executing → Registration failed
- Column names in migration don't match entity → Will break in production
- Migration is not idempotent → Will fail on re-run

### Example Comment When Creating Migration

When you create a migration, add a task comment documenting it:

```
Created migration `1700000000001-AddUserEmail.ts`:
- ✅ File created in apps/backend/src/migrations/
- ✅ Registered in app.module.ts line 32
- ✅ Verified with grep (2 matches found)
- ✅ Tested with npm run dev (migration executed successfully)
- ✅ Idempotent (checks if column exists before adding)
```
```

### 2. Add Pre-PR Validation Protocol

**Insert into developer agent system prompt:**

```markdown
## Pre-PR Validation Protocol

Before creating a pull request, run these validation checks:

### For All PRs
- [ ] `npm run build` (or equivalent) - Verify code compiles
- [ ] `npm run test` (or equivalent) - Verify tests pass
- [ ] Grep for TODO comments you added - Remove or track them

### For PRs with Database Changes
- [ ] Entity changes have corresponding migration OR migration has corresponding entity changes
- [ ] All migrations are registered (grep for class name in config)
- [ ] Ran application locally and verified migration executed
- [ ] Column names in migration match entity `@Column({ name: '...' })`

### For PRs with Entity Changes
- [ ] If adding/renaming columns, migration exists
- [ ] Column names match database schema (check camelCase vs snake_case)
- [ ] Nullable/required matches migration constraints

### Self-Review Checklist

Before creating PR, review your own changes:
1. Read through every file you modified
2. Check for common mistakes (see project-specific docs)
3. Verify all imports are used
4. Verify all created files are referenced
5. Run validation commands from project docs

**If any validation fails, fix it before creating PR.**
```

### 3. Add Self-Verification Habit

**Insert into developer agent system prompt:**

```markdown
## Self-Verification Protocol

After completing any multi-step task, perform self-verification:

1. **List all artifacts created:**
   - Files created/modified
   - Configuration changes
   - Database changes
   - Documentation updates

2. **For each artifact, verify it's "connected":**
   - New files → Are they imported/referenced elsewhere?
   - New classes → Are they registered/instantiated?
   - New configs → Are they loaded by the application?
   - New migrations → Are they in the migrations array?

3. **Use grep to verify connections:**
   ```bash
   # For a new class
   grep -r "NewClassName" . --exclude-dir=node_modules

   # For a new file
   grep -r "path/to/new-file" . --exclude-dir=node_modules
   ```

4. **Expected: Multiple results**
   - 1 result = Definition only (likely not connected)
   - 2+ results = Definition + usage (properly connected)

**If any artifact shows only 1 grep result, investigate why.**
```

## Recommendations for Code Reviewer Agent Prompts

### 1. Add Migration Review Checklist

**Insert into reviewer agent system prompt:**

```markdown
## Migration Review Checklist (CRITICAL)

When reviewing PRs that add or modify migrations:

### MANDATORY Checks (REQUEST CHANGES if any fail)

1. **Registration Check** (MOST CRITICAL):
   ```bash
   grep -r "<MigrationClassName>" <config-file>
   ```
   - MUST return at least 2 results (import + array entry)
   - If 0 results → **IMMEDIATE REQUEST CHANGES** with HIGH SEVERITY
   - If 1 result → Likely registered but not imported, or vice versa

2. **Import Check:**
   - Migration class must be imported at top of config file
   - Import path must be correct

3. **Array Check:**
   - Migration must appear in migrations array
   - Must be in correct timestamp order

4. **Idempotency Check:**
   - Migration must check if changes already exist
   - Keywords to look for: `table_info`, `sqlite_master`, `IF NOT EXISTS`, existence check
   - If no checks found → REQUEST CHANGES

5. **Rollback Check:**
   - `down()` method must reverse what `up()` does
   - Cannot be empty or just throw error

6. **Testing Evidence:**
   - PR description must include test output
   - Test output must show migration executed
   - If no evidence → REQUEST CHANGES

### Review Comment Template

When reviewing migrations, use this template:

```markdown
## Migration Review

**Registration:** ✅/❌
- Import: ✅/❌ (line XX)
- Array: ✅/❌ (line YY)
- Grep verification: ✅/❌ (X results)

**Idempotency:** ✅/❌/⚠️
- [Details of checks found or missing]

**Rollback:** ✅/❌/⚠️
- [Details of down() method]

**Testing:** ✅/❌
- [Evidence of testing found or missing]

**Decision:** APPROVE / REQUEST CHANGES / COMMENT

[Additional comments]
```

### Critical Anti-Pattern Detection

**Auto-reject these patterns:**

```typescript
// ❌ PATTERN 1: Unregistered migration
// File exists: src/migrations/1234-AddColumn.ts
// But grep for "AddColumn1234" in app.module.ts returns nothing
→ REQUEST CHANGES: "Migration not registered in app.module.ts"

// ❌ PATTERN 2: Non-idempotent migration
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
  // No check if column already exists
}
→ REQUEST CHANGES: "Migration is not idempotent - must check if column exists first"

// ❌ PATTERN 3: Empty rollback
public async down(queryRunner: QueryRunner): Promise<void> {
  // TODO: implement rollback
}
→ REQUEST CHANGES: "down() method must implement proper rollback"

// ❌ PATTERN 4: Wrong column names
// Entity: @Column({ name: 'user_email' })
// Migration: ADD COLUMN userEmail VARCHAR(255)
→ REQUEST CHANGES: "Column name in migration (userEmail) doesn't match entity (user_email)"
```
```

### 2. Add Systematic Review Protocol

**Insert into reviewer agent system prompt:**

```markdown
## Systematic PR Review Protocol

For every PR, review in this order:

### 1. File-Level Review
- List all files changed
- Categorize: New files, modified files, deleted files
- For each new file, verify it's referenced elsewhere

### 2. Pattern Detection
- Check for common anti-patterns (see project docs)
- Check for security issues
- Check for performance issues

### 3. Specific Checks by File Type

**If PR includes migration files:**
- Run migration review checklist (see above)
- **CRITICAL:** Verify registration before anything else

**If PR includes entity files:**
- Verify matching migration exists (for schema changes)
- Check column names match migration

**If PR includes configuration files:**
- Verify new imports are used
- Verify new array entries are valid

### 4. Testing Evidence
- PR must include evidence of testing
- For migrations: Must show migration executed successfully
- For API changes: Must show manual testing or automated tests

### 5. Documentation
- PR description must explain what and why
- Complex changes must update relevant docs
- Breaking changes must be clearly marked

**If any critical check fails, REQUEST CHANGES immediately.**
```

## Recommendations for General Agent Improvements

### 1. Add "Verification Mode" Step

**Insert into all agent system prompts:**

```markdown
## Task Completion - Verification Mode

Before marking any task as complete:

1. **Enter Verification Mode**
   - Review all artifacts you created
   - Check all checklist items
   - Run all validation commands

2. **Artifact Completeness Check**
   - If you created file A, check if it needs to be imported elsewhere
   - If you created class B, check if it needs to be registered
   - If you created config C, check if it's loaded by the application

3. **Use Tools to Verify**
   - Grep for class names outside their definition file
   - Grep for file paths/imports
   - Run build/test commands

4. **Common Verification Commands**
   ```bash
   # Verify a class is used
   grep -r "ClassName" . --exclude-dir=node_modules | wc -l
   # Should be > 1 (definition + usage)

   # Verify build works
   npm run build

   # Verify tests pass
   npm run test

   # Verify app starts
   npm run dev
   ```

5. **Document Verification**
   - Add comment showing verification was done
   - Include command outputs
   - List what was verified

**Only mark task complete after verification mode succeeds.**
```

### 2. Add Confidence Calibration

**Insert into all agent system prompts:**

```markdown
## Confidence Calibration

When providing analysis or recommendations:

1. **Distinguish between verified and assumed**
   - "I verified X by running Y" vs "I assume X because Y"
   - Show commands you ran and their output
   - Don't claim verification without evidence

2. **Express uncertainty appropriately**
   - If unsure, say so: "I'm not certain, but..."
   - Avoid overconfident language: "This is definitely safe"
   - Prefer hedged language: "This should be safe because..."

3. **Verification levels**
   - 🟢 High confidence: Ran command, saw output, verified behavior
   - 🟡 Medium confidence: Read code, logic seems sound, but didn't run
   - 🔴 Low confidence: Making educated guess based on patterns

4. **When reviewing others' code**
   - Don't approve based on trust alone
   - Run verification commands even if PR looks good
   - Check for common mistakes systematically

**Example calibrated responses:**

❌ Bad: "This is safe to merge, the migration looks correct."
✅ Good: "I verified the migration is registered (grep found 2 matches), is idempotent (checks column existence), and has proper rollback. Testing evidence shows it executed successfully. Recommending approval."

❌ Bad: "I analyzed the code and recommend approval."
✅ Good: "I checked the migration registration (✅), idempotency (✅), and testing evidence (✅). However, I didn't verify the column names match the entity - that should be checked by a second reviewer."
```

## Implementation Priority

### Immediate (Add Now)
1. Migration creation protocol for dev agents
2. Migration review checklist for reviewer agents
3. Verification mode for all agents

### Short-term (Add This Month)
1. Confidence calibration guidelines
2. Systematic review protocol
3. Self-verification habits

### Long-term (Add This Quarter)
1. Agent-specific validation scripts
2. Automated verification tools
3. Learning from incidents (feedback loop)

## Measuring Success

Track these metrics after implementing improvements:

1. **Prevented incidents:**
   - How many times does an agent catch unregistered migrations?
   - How many times does verification mode prevent incomplete work?

2. **Incident rate:**
   - Database-related production incidents per month
   - Agent-caused critical bugs per month

3. **Review quality:**
   - How many bugs are caught in review vs production?
   - How many critical issues are marked in PRs?

4. **Agent confidence calibration:**
   - How often do agents express appropriate uncertainty?
   - How often do agents provide verification evidence?

**Goal:** Reduce database-related production incidents from 1/month to 0/quarter.

## See Also

- [Incident Report](./2026-02-13-context-mcp-migration-incident.md)
- [How to Create a Migration](../how-to-guides/create-a-migration.md)
- [Migration Review Guide](../review-guides/migration.md)
- [CLAUDE.md Database Migrations Section](../../CLAUDE.md#database-migrations)

## Questions for Human Review

1. Should we enforce migration registration at CI level (linting/validation)?
2. Should we create automated scripts to verify agent work?
3. Should we add "verification mode" as a mandatory agent step?
4. Should we implement confidence calibration across all agent responses?
5. What other patterns should we add to agent prompts?
