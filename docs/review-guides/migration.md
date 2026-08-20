# Migration Review Guide

Use this checklist when reviewing PRs that add or modify database migrations.

## Critical Checks

### ✅ Migration File Structure

- [ ] Migration file exists in `apps/backend/src/migrations/` directory
- [ ] Filename follows pattern: `<timestamp>-<DescriptiveName>.ts`
- [ ] Class name matches filename: `<DescriptiveName><timestamp>`
- [ ] Implements `MigrationInterface`
- [ ] Has both `up()` and `down()` methods
- [ ] Both methods have proper return type: `Promise<void>`

### ✅ Registration (MOST CRITICAL)

**This is the #1 most common critical error. A migration file without registration will never run.**

- [ ] Migration class is imported in `apps/backend/src/app.module.ts`
- [ ] Migration class is added to the `migrations` array
- [ ] Migration is in correct timestamp order in the array
- [ ] Run this verification command:
  ```bash
  grep -r "<MigrationClassName>" apps/backend/src/app.module.ts
  ```
  Must return at least 2 results (import + array entry)

**If any registration check fails, REQUEST CHANGES immediately.**

### ✅ Idempotency

Migrations MUST be safe to run multiple times:

- [ ] Checks if table exists before creating: `SELECT name FROM sqlite_master WHERE type='table'`
- [ ] Checks if column exists before adding: `PRAGMA table_info(table_name)`
- [ ] Checks if index exists before creating: `PRAGMA index_list(table_name)`
- [ ] Uses conditional logic to skip already-applied changes

**Red flags:**
- ❌ Direct `CREATE TABLE` without existence check
- ❌ Direct `ALTER TABLE ADD COLUMN` without existence check
- ❌ Assumes clean slate or specific state

### ✅ Rollback Support

- [ ] `down()` method properly reverses `up()` changes
- [ ] If `up()` adds column, `down()` removes it
- [ ] If `up()` creates table, `down()` drops it
- [ ] If `up()` modifies data, `down()` explains why it can't revert (if impossible)

### ✅ SQL Quality

- [ ] SQL syntax is valid for SQLite
- [ ] Table and column names match entity definitions
- [ ] Foreign keys are properly defined
- [ ] Indexes are created for frequently queried columns
- [ ] Default values are appropriate
- [ ] Nullable vs NOT NULL is correct

### ✅ Testing Evidence

- [ ] PR description includes `npm run zero-to-prod` output
- [ ] PR description includes `npm run dev` output showing migration ran
- [ ] Migration logs show successful execution
- [ ] No errors in test output

## Schema Alignment Checks

### Column Names

Check that migration column names match entity definitions:

1. **Find the entity:**
   ```bash
   # Look for the entity file
   find apps/backend/src -name "*.entity.ts" | xargs grep -l "tableName"
   ```

2. **Compare column names:**
   - Entity uses `@Column({ name: 'snake_case' })` → migration must use `snake_case`
   - Entity uses `@Column()` without name → TypeORM defaults to camelCase
   - **If mismatch found, this will break production!**

### Data Types

- [ ] VARCHAR lengths match between entity and migration
- [ ] TEXT vs VARCHAR choice is consistent
- [ ] DATETIME vs TIMESTAMP is consistent
- [ ] Nullable columns match entity `nullable: true/false`

## Common Anti-Patterns

### 🚨 Critical: Unregistered Migration

**Symptom:**
```typescript
// Migration file exists: 1700000000001-AddUserEmail.ts
// But NOT in app.module.ts migrations array
```

**Impact:** Migration never runs, production breaks when entity expects columns that don't exist.

**Action:** REQUEST CHANGES - Migration must be registered.

### 🚨 Critical: Wrong Column Names

**Symptom:**
```typescript
// Entity:
@Column({ name: 'authorization_code' })
authorizationCode: string;

// Migration:
ALTER TABLE flows ADD COLUMN authorizationCode VARCHAR(500);
//                           ^^^^^^^^^^^^^^^^^ WRONG - should be authorization_code
```

**Impact:** Entity-database mismatch, production errors.

**Action:** REQUEST CHANGES - Column names must match entity.

### ⚠️ Warning: Non-Idempotent Migration

**Symptom:**
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`CREATE TABLE users (...)`);
  // No check if table already exists
}
```

**Impact:** Migration fails on second run.

**Action:** REQUEST CHANGES - Add existence checks.

### ⚠️ Warning: Incomplete Rollback

**Symptom:**
```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // Empty or just throws
  throw new Error('Cannot rollback');
}
```

**Impact:** Can't revert migration if needed.

**Action:** REQUEST CHANGES - Implement proper rollback or document why impossible.

### ⚠️ Warning: Assumes Specific State

**Symptom:**
```typescript
// Assumes table has exactly these columns, no more, no less
await queryRunner.query(`
  CREATE TABLE users_new AS SELECT id, name FROM users
`);
```

**Impact:** Breaks if table schema differs from assumption.

**Action:** REQUEST CHANGES - Use dynamic schema inspection.

## Verification Commands

Run these commands during review:

### Check Registration
```bash
# Replace MigrationClassName with actual class name
grep -r "MigrationClassName" apps/backend/src/app.module.ts
```

Expected: 2 results (import + array)

### Check Migration Order
```bash
grep -A 20 "migrations:" apps/backend/src/app.module.ts
```

Expected: Migrations in timestamp order

### Find Related Entity
```bash
# Replace table_name with actual table from migration
grep -r "connection_authorization_flows" apps/backend/src --include="*.entity.ts"
```

### Compare Column Names
```bash
# In migration file
grep "ADD COLUMN\|RENAME COLUMN" apps/backend/src/migrations/<migration-file>.ts

# In entity file
grep "@Column" apps/backend/src/<module>/entities/<entity>.ts
```

## PR Requirements

Before approving, verify PR description includes:

- [ ] **What:** Clear description of schema change
- [ ] **Why:** Business reason for the change
- [ ] **Registration:** Explicit statement "Migration registered in app.module.ts line XXX"
- [ ] **Testing:** Output from `npm run dev` showing migration executed
- [ ] **Rollback plan:** How to revert if deployment fails

**Example good PR description:**

```markdown
## Summary

Adds email column to users table for email notification feature.

## Changes

- Created migration `1700000000001-AddUserEmailColumn.ts`
- Migration registered in `app.module.ts` line 32
- Migration is idempotent (checks column existence)
- Includes rollback in down() method

## Testing

✅ `npm run zero-to-prod` - Build successful
✅ `npm run dev` - Migration ran successfully

Migration logs:
```
[TypeORM] Running migrations: [..., AddUserEmailColumn1700000000001]
[TypeORM] Migration AddUserEmailColumn1700000000001 has been executed successfully
```

## Rollback Plan

If deployment fails, the down() method will:
1. Remove the email column
2. Restore table to previous state
```

## Auto-Check Script

Consider running this script during review:

```bash
#!/bin/bash
# migration-review.sh

MIGRATION_FILE=$1
CLASS_NAME=$(grep "export class" "$MIGRATION_FILE" | sed 's/.*class \([^ ]*\).*/\1/')

echo "🔍 Checking migration: $CLASS_NAME"

# Check registration
echo -n "✓ Registration: "
if grep -q "$CLASS_NAME" apps/backend/src/app.module.ts; then
  echo "✅ Found in app.module.ts"
else
  echo "❌ NOT FOUND IN app.module.ts - CRITICAL ERROR"
  exit 1
fi

# Check methods
echo -n "✓ Up method: "
grep -q "public async up" "$MIGRATION_FILE" && echo "✅" || echo "❌"

echo -n "✓ Down method: "
grep -q "public async down" "$MIGRATION_FILE" && echo "✅" || echo "❌"

# Check idempotency
echo -n "✓ Idempotent checks: "
if grep -q "table_info\|sqlite_master" "$MIGRATION_FILE"; then
  echo "✅ Has existence checks"
else
  echo "⚠️  No existence checks found"
fi

echo ""
echo "📋 Review complete. Check output above for issues."
```

Usage:
```bash
chmod +x scripts/migration-review.sh
./scripts/migration-review.sh apps/backend/src/migrations/1700000000001-AddUserEmail.ts
```

## Decision Tree

```
┌─────────────────────────────────────┐
│ Is migration file present?          │
└────────────┬────────────────────────┘
             │ Yes
             ▼
┌─────────────────────────────────────┐
│ Is it registered in app.module.ts?  │
└────────────┬────────────────────────┘
             │ Yes
             ▼
┌─────────────────────────────────────┐
│ Does it have up() and down()?       │
└────────────┬────────────────────────┘
             │ Yes
             ▼
┌─────────────────────────────────────┐
│ Is it idempotent?                   │
└────────────┬────────────────────────┘
             │ Yes
             ▼
┌─────────────────────────────────────┐
│ Do column names match entity?       │
└────────────┬────────────────────────┘
             │ Yes
             ▼
┌─────────────────────────────────────┐
│ ✅ APPROVE with comment             │
└─────────────────────────────────────┘

Any "No" → REQUEST CHANGES
```

## Related Guides

- [How to Create a Migration](../how-to-guides/create-a-migration.md)
- [Entity Review Guide](./entity.md)
- [Incident Report: Unregistered Migration](../incident-reports/2026-02-13-context-mcp-migration-incident.md)

## When in Doubt

**If you're unsure about ANY aspect of a migration, REQUEST CHANGES and ask questions.**

Database migrations are high-risk changes. It's better to be cautious than to break production.

Remember: A migration that doesn't run is worse than no migration at all, because the code will expect a schema that doesn't exist.
