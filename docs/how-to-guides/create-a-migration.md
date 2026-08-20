# How to Create a Database Migration

This guide shows you how to create and register a TypeORM migration safely.

## Prerequisites

- Understanding of TypeORM migrations
- Knowledge of the database schema change you need to make
- Understanding of SQL (SQLite in this project)

## Steps

### 1. Create the Migration File

Create a new file in `apps/backend/src/migrations/` with the naming pattern:

```
<timestamp>-<DescriptiveName>.ts
```

Example: `1700000000001-AddUserEmailColumn.ts`

**Migration Template:**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserEmailColumn1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add your schema changes here
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN email VARCHAR(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert your schema changes here
    // Note: DROP COLUMN requires SQLite 3.35.0+ (March 2021)
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN email
    `);
  }
}
```

### 2. Make Migration Idempotent

**IMPORTANT:** Migrations should be safe to run multiple times. Always check if changes already exist.

**Example for SQLite:**

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // Check if column already exists
  const tableInfo: Array<{ name: string }> = await queryRunner.query(`
    PRAGMA table_info(users)
  `);

  const columnExists = tableInfo.some(col => col.name === 'email');

  if (!columnExists) {
    await queryRunner.query(`
      ALTER TABLE users ADD COLUMN email VARCHAR(255)
    `);
  }
}
```

### 3. Register the Migration

**CRITICAL STEP - DO NOT SKIP:**

Edit `apps/backend/src/app.module.ts`:

1. **Import the migration class** at the top:

```typescript
import { AddUserEmailColumn1700000000001 } from './migrations/1700000000001-AddUserEmailColumn';
```

2. **Add to migrations array** in timestamp order:

```typescript
TypeOrmModule.forRoot({
  // ...
  migrations: [
    BaselineSchema1700000000000,
    AddUserEmailColumn1700000000001,  // ← Add your migration here
  ],
}),
```

### 4. Verify Registration

Run this command to verify your migration is registered:

```bash
grep -r "AddUserEmailColumn1700000000001" apps/backend/src/app.module.ts
```

If this returns **nothing**, your migration is NOT registered and will NOT run. Go back to step 3.

Expected output:
```
apps/backend/src/app.module.ts:import { AddUserEmailColumn1700000000001 } from './migrations/1700000000001-AddUserEmailColumn';
apps/backend/src/app.module.ts:    AddUserEmailColumn1700000000001,
```

### 5. Test the Migration

1. **Build test:**
   ```bash
   npm run zero-to-prod
   ```
   This verifies your migration compiles correctly.

2. **Runtime test:**
   ```bash
   npm run dev
   ```
   Check the console output for migration logs. You should see:
   ```
   [TypeORM] Running migrations: [..., AddUserEmailColumn1700000000001]
   [TypeORM] Migration AddUserEmailColumn1700000000001 has been executed successfully
   ```

3. **Verify schema change:**
   ```bash
   # Connect to your dev database
   sqlite3 apps/backend/taico-dev.db

   # Check the schema
   PRAGMA table_info(users);
   ```

### 6. Document in PR

When creating your PR, include:

- **What the migration does** (high-level description)
- **Why it's needed** (what problem it solves)
- **Registration confirmation:** "Migration registered in app.module.ts line XXX"
- **Test results:** Output from `npm run dev` showing migration ran

**Example PR description:**

````markdown
## Summary

Adds email column to users table for email notifications feature.

## Changes

- Created migration `1700000000001-AddUserEmailColumn.ts`
- Registered migration in `app.module.ts` (line 32)
- Migration is idempotent (checks if column exists before adding)

## Testing

✅ `npm run zero-to-prod` - Build successful
✅ `npm run dev` - Migration ran successfully:

```
[TypeORM] Running migrations: [AddUserEmailColumn1700000000001]
[TypeORM] Migration AddUserEmailColumn1700000000001 has been executed successfully
```
````

## Common Mistakes

### ❌ Mistake #1: Not Registering the Migration

**Symptom:** Migration file exists, CI passes, but migration doesn't run in production.

**Cause:** Forgot to import and add migration to `app.module.ts` migrations array.

**Fix:** Always run the grep verification command from step 4.

### ❌ Mistake #2: Not Making It Idempotent

**Symptom:** Migration works first time but fails on subsequent runs.

**Cause:** Migration assumes a clean state and doesn't check if changes already exist.

**Fix:** Always check current schema state before making changes.

### ❌ Mistake #3: Wrong Timestamp Order

**Symptom:** Migrations run in wrong order, causing dependency errors.

**Cause:** Timestamp in filename doesn't match execution order in migrations array.

**Fix:** Ensure migrations array is sorted by timestamp ascending.

### ❌ Mistake #4: Missing Down Migration

**Symptom:** Can't rollback migration when needed.

**Cause:** `down()` method is empty or doesn't properly revert changes.

**Fix:** Always implement `down()` that reverses what `up()` does.

### ❌ Mistake #5: Assuming Column Names

**Symptom:** Migration fails because column names don't match entity.

**Cause:** Not checking actual database schema before writing migration.

**Fix:** Check production schema with `PRAGMA table_info(table_name)` first.

## SQLite-Specific Notes

### SQLite Version Requirements

This project uses SQLite 3.x. Be aware of version-specific features:

- **DROP COLUMN**: Requires SQLite 3.35.0+ (March 2021)
- **RENAME COLUMN**: Requires SQLite 3.25.0+ (September 2018)

For older SQLite versions, use the table rebuild approach (see below).

### Column Renaming (SQLite 3.25+)

```typescript
await queryRunner.query(`
  ALTER TABLE table_name RENAME COLUMN old_name TO new_name
`);
```

### Column Dropping (SQLite 3.35+)

```typescript
await queryRunner.query(`
  ALTER TABLE table_name DROP COLUMN column_name
`);
```

### Table Rebuild Approach (Older SQLite Versions)

If your SQLite version doesn't support DROP COLUMN or RENAME COLUMN, use the table rebuild pattern:

```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // For older SQLite: rebuild table without the column
  await queryRunner.query(`
    CREATE TABLE users_backup AS SELECT id, name FROM users
  `);
  await queryRunner.query(`DROP TABLE users`);
  await queryRunner.query(`ALTER TABLE users_backup RENAME TO users`);
}
```

### Checking Column Existence

```typescript
const tableInfo: Array<{ name: string }> = await queryRunner.query(`
  PRAGMA table_info(table_name)
`);
const hasColumn = tableInfo.some(col => col.name === 'column_name');
```

### Checking Table Existence

```typescript
const tables: Array<{ name: string }> = await queryRunner.query(`
  SELECT name FROM sqlite_master WHERE type='table' AND name='table_name'
`);
const tableExists = tables.length > 0;
```

## Rollback Strategy

**This repo does not have TypeORM CLI configured.** Migrations run automatically at application startup via the TypeORM module configuration in `app.module.ts`.

**For production:** Always use forward migrations to undo changes. Create a new migration that reverses the changes from the previous one. This approach:
- Maintains a complete audit trail
- Is safer for production environments
- Doesn't require direct database access
- Works consistently across all environments

**Example:** If you need to remove a column you just added, create a new migration with a `down()`-like implementation in its `up()` method.

## Production Deployment Checklist

Before merging a PR with migrations:

- [ ] Migration file created in `apps/backend/src/migrations/`
- [ ] Migration imported in `app.module.ts`
- [ ] Migration added to migrations array in correct timestamp order
- [ ] Verified with grep that migration is registered
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Both `up()` and `down()` methods implemented
- [ ] Tested with `npm run dev` (migration runs successfully)
- [ ] PR description documents what migration does
- [ ] PR includes test validation output
- [ ] Code review approved by human

## See Also

- [Entity Creation Guide](./create-an-entity.md)
- [Migration Review Guide](../review-guides/migration.md)
- [TypeORM Migration Docs](https://typeorm.io/migrations)
- [Incident Report: Migration Not Registered](../incident-reports/2026-02-13-context-mcp-migration-incident.md) - Real-world example of what happens when you skip registration

## Questions?

If you're unsure about any step, ask before creating the PR. It's much easier to get it right the first time than to fix a production incident.
