/**
 * One-off migration: encrypt legacy plaintext rows in `secrets.encrypted_value`
 * with AES-256-GCM, using the same envelope the running app expects.
 *
 * Usage (reads configuration from the environment only, never from argv):
 *   DATABASE_URL=... SECRETS_ENCRYPTION_KEY=<64 hex> \
 *     npx ts-node -r tsconfig-paths/register scripts/encrypt-existing-secrets.ts          # dry run (default)
 *   DATABASE_URL=... SECRETS_ENCRYPTION_KEY=<64 hex> \
 *     npx ts-node -r tsconfig-paths/register scripts/encrypt-existing-secrets.ts --apply  # write
 *
 * Safety properties:
 * - Dry run is the default; nothing is written without --apply.
 * - All rows are read with FOR UPDATE inside one transaction. Any row that is
 *   envelope-shaped but does not authenticate with the key aborts the run.
 * - Each update is guarded by the observed row_version and the old value, and
 *   a round-trip decrypt is verified before the write.
 * - Idempotent: a second run finds zero plaintext rows and changes nothing.
 * - Never prints secret values or the key. Only ids, names and counts.
 *
 * IMPORTANT: run this while the app is NOT serving traffic (stop taico first),
 * because a running plaintext-mode instance would read the encrypted rows back
 * as raw ciphertext. See k8s/taico docs/SECRETS-ENCRYPTION.md in spark-ops.
 */
import { Client } from 'pg';
import {
  classifyStoredSecret,
  decryptEnvelope,
  encryptEnvelope,
  parseKeyHex,
} from '../src/secrets/secret-storage-format';

interface SecretRow {
  id: string;
  name: string;
  encrypted_value: string;
  row_version: number;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const databaseUrl = process.env.DATABASE_URL;
  const keyHex = process.env.SECRETS_ENCRYPTION_KEY;
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  if (!keyHex) throw new Error('SECRETS_ENCRYPTION_KEY is required.');
  const key = parseKeyHex(keyHex);

  const client = new Client({
    connectionString: databaseUrl,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await client.connect();

  const counts = { encrypted: 0, plaintext: 0, ambiguous: 0, migrated: 0 };
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<SecretRow>(
      'SELECT id, name, encrypted_value, row_version FROM secrets ORDER BY created_at, id FOR UPDATE',
    );

    const plan: Array<{ row: SecretRow; next: string }> = [];
    for (const row of rows) {
      const classification = classifyStoredSecret(row.encrypted_value, key);
      counts[classification] += 1;
      if (classification === 'ambiguous') {
        console.error(
          `AMBIGUOUS row id=${row.id} name=${row.name}: envelope-shaped but does not authenticate with this key. Aborting; nothing written.`,
        );
        throw new Error('Ambiguous rows present');
      }
      if (classification === 'plaintext') {
        const next = encryptEnvelope(row.encrypted_value, key);
        if (decryptEnvelope(next, key) !== row.encrypted_value) {
          throw new Error(`Round-trip verification failed for id=${row.id}`);
        }
        plan.push({ row, next });
      }
    }

    console.log(
      `Scanned ${rows.length} rows: ${counts.encrypted} already encrypted, ${counts.plaintext} plaintext to encrypt.`,
    );

    if (!apply) {
      await client.query('ROLLBACK');
      for (const { row } of plan)
        console.log(`  would encrypt id=${row.id} name=${row.name}`);
      console.log('Dry run only. Re-run with --apply to write.');
      return;
    }

    for (const { row, next } of plan) {
      const result = await client.query(
        'UPDATE secrets SET encrypted_value = $1, row_version = row_version + 1, updated_at = now() WHERE id = $2 AND row_version = $3 AND encrypted_value = $4',
        [next, row.id, row.row_version, row.encrypted_value],
      );
      if (result.rowCount !== 1) {
        throw new Error(
          `Concurrent modification detected for id=${row.id}; rolled back.`,
        );
      }
      counts.migrated += 1;
      console.log(`  encrypted id=${row.id} name=${row.name}`);
    }
    await client.query('COMMIT');
    console.log(`Committed. Encrypted ${counts.migrated} rows.`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // Print the message only; never the row values or the key.
  console.error(`encrypt-existing-secrets failed: ${(error as Error).message}`);
  process.exit(1);
});
