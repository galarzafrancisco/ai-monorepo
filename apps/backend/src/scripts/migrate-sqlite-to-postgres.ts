import * as sqlite3 from 'sqlite3';
import { Client } from 'pg';

type Row = Record<string, unknown>;

type Column = {
  name: string;
  dataType: string;
  nullable: boolean;
};

type ForeignKey = {
  constraintName: string;
  childTable: string;
  childColumns: string[];
  parentTable: string;
  parentColumns: string[];
};

type ArchivedRow = {
  sourceDatabase: string;
  sourceTable: string;
  sourceKey: string | null;
  reason: string;
  rowData: Row;
};

const sqlite =
  (sqlite3 as unknown as { default?: typeof sqlite3 }).default ?? sqlite3;

const sqlitePath = process.env.SQLITE_PATH;
const databaseUrl = process.env.DATABASE_URL;
const recoverySqlitePath = process.env.RECOVERY_SQLITE_PATH;
const chatSqlitePath = process.env.CHAT_SQLITE_PATH;

if (!sqlitePath || !databaseUrl) {
  throw new Error('SQLITE_PATH and DATABASE_URL are required');
}

const requiredSqlitePath = sqlitePath;
const requiredDatabaseUrl = databaseUrl;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function openReadOnly(filename: string): sqlite3.Database {
  return new sqlite.Database(filename, sqlite.OPEN_READONLY);
}

function all(
  db: sqlite3.Database,
  sql: string,
  params: unknown[] = [],
): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows: Row[]) => {
      if (error) reject(error);
      else resolve(rows);
    });
  });
}

function close(db: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) => {
    db.close((error) => (error ? reject(error) : resolve()));
  });
}

async function readDatabase(filename: string): Promise<Map<string, Row[]>> {
  const db = openReadOnly(filename);
  try {
    await all(db, 'BEGIN');
    const tables = await all(
      db,
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    );
    const result = new Map<string, Row[]>();
    for (const table of tables) {
      const name = String(table.name);
      result.set(name, await all(db, `SELECT * FROM ${quoteIdentifier(name)}`));
    }
    await all(db, 'COMMIT');
    return result;
  } finally {
    await close(db);
  }
}

async function recoverContextBlocks(
  source: Map<string, Row[]>,
  recoveryFilename: string,
): Promise<Set<string>> {
  const blocks = source.get('context_blocks') ?? [];
  const blockIds = new Set(blocks.map((row) => String(row.id)));
  const missingIds = new Set<string>();

  for (const relation of source.get('context_block_tags') ?? []) {
    const id = String(relation.block_id);
    if (!blockIds.has(id)) missingIds.add(id);
  }

  for (const thread of source.get('threads') ?? []) {
    const id = String(thread.state_context_block_id);
    if (id && !blockIds.has(id)) missingIds.add(id);
  }

  if (missingIds.size === 0) return new Set();

  const recovery = openReadOnly(recoveryFilename);
  const recovered = new Set<string>();
  try {
    while (missingIds.size > 0) {
      const id = missingIds.values().next().value as string;
      missingIds.delete(id);
      if (blockIds.has(id)) continue;

      const rows = await all(
        recovery,
        'SELECT * FROM context_blocks WHERE id = ?',
        [id],
      );
      if (rows.length !== 1) continue;

      const row = rows[0];
      blocks.push(row);
      blockIds.add(id);
      recovered.add(id);

      if (row.parent_id && !blockIds.has(String(row.parent_id))) {
        missingIds.add(String(row.parent_id));
      }
    }
  } finally {
    await close(recovery);
  }

  source.set('context_blocks', blocks);
  return recovered;
}

function sourceKey(row: Row): string | null {
  const preferred = ['id', 'task_id', 'thread_id', 'block_id', 'session_id'];
  const parts = preferred
    .filter((column) => row[column] !== undefined && row[column] !== null)
    .map((column) => `${column}=${String(row[column])}`);
  return parts.length > 0 ? parts.join(',') : null;
}

function keyFor(row: Row, columns: string[]): string | null {
  const values = columns.map((column) => row[column]);
  if (values.some((value) => value === null || value === undefined))
    return null;
  return JSON.stringify(values);
}

function convertValue(value: unknown, dataType: string): unknown {
  if (value === null || value === undefined) return null;
  if (dataType === 'boolean')
    return value === true || value === 1 || value === '1';
  if (dataType === 'jsonb') {
    if (typeof value === 'string') return JSON.parse(value);
    return value;
  }
  if (dataType === 'timestamp with time zone' && typeof value === 'number') {
    const milliseconds = value < 10_000_000_000 ? value * 1000 : value;
    return new Date(milliseconds);
  }
  return value;
}

async function insertRows(
  client: Client,
  table: string,
  columns: Column[],
  rows: Row[],
): Promise<void> {
  if (rows.length === 0) return;
  const batchSize = 250;
  const names = columns.map((column) => column.name);

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    const values: unknown[] = [];
    const tuples = batch.map((row) => {
      const placeholders = names.map((name) => {
        values.push(row[name]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    await client.query(
      `INSERT INTO ${quoteIdentifier(table)} (${names.map(quoteIdentifier).join(', ')}) VALUES ${tuples.join(', ')}`,
      values,
    );
  }
}

async function main(): Promise<void> {
  const source = await readDatabase(requiredSqlitePath);
  const archive: ArchivedRow[] = [];
  let recoveredContextBlocks = new Set<string>();

  if (recoverySqlitePath) {
    recoveredContextBlocks = await recoverContextBlocks(
      source,
      recoverySqlitePath,
    );
    for (const row of source.get('context_blocks') ?? []) {
      if (recoveredContextBlocks.has(String(row.id))) {
        archive.push({
          sourceDatabase: recoverySqlitePath,
          sourceTable: 'context_blocks',
          sourceKey: sourceKey(row),
          reason: 'recovered missing parent row from backup',
          rowData: { ...row },
        });
      }
    }
  }

  const client = new Client({
    connectionString: requiredDatabaseUrl,
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: true }
        : false,
  });
  await client.connect();

  try {
    const columnResult = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT table_name, column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
    );

    const columnsByTable = new Map<string, Column[]>();
    for (const row of columnResult.rows) {
      const columns = columnsByTable.get(row.table_name) ?? [];
      columns.push({
        name: row.column_name,
        dataType: row.data_type,
        nullable: row.is_nullable === 'YES',
      });
      columnsByTable.set(row.table_name, columns);
    }

    const targetTables = [...columnsByTable.keys()].filter(
      (table) =>
        source.has(table) &&
        table !== 'migrations' &&
        table !== 'typeorm_metadata',
    );
    const targetRows = new Map<string, Row[]>();

    for (const table of targetTables) {
      const columns = columnsByTable.get(table)!;
      const sourceRows = source.get(table) ?? [];
      targetRows.set(
        table,
        sourceRows.map((row) =>
          Object.fromEntries(
            columns
              .filter((column) => row[column.name] !== undefined)
              .map((column) => [
                column.name,
                convertValue(row[column.name], column.dataType),
              ]),
          ),
        ),
      );
    }

    const chatTableMappings: Record<string, string> = {
      sessions: 'adk_sessions',
      events: 'adk_events',
      app_state: 'adk_app_state',
      user_state: 'adk_user_state',
    };
    if (chatSqlitePath) {
      const chatSource = await readDatabase(chatSqlitePath);
      for (const [sourceTable, targetTable] of Object.entries(
        chatTableMappings,
      )) {
        const columns = columnsByTable.get(targetTable)!;
        targetRows.set(
          targetTable,
          (chatSource.get(sourceTable) ?? []).map((row) =>
            Object.fromEntries(
              columns.map((column) => [
                column.name,
                convertValue(row[column.name], column.dataType),
              ]),
            ),
          ),
        );
      }
    }

    for (const [table, rows] of source) {
      if (!targetTables.includes(table)) {
        for (const row of rows) {
          archive.push({
            sourceDatabase: requiredSqlitePath,
            sourceTable: table,
            sourceKey: sourceKey(row),
            reason: 'legacy or migration-only SQLite table',
            rowData: row,
          });
        }
      }
    }

    const fkResult = await client.query<{
      constraint_name: string;
      child_table: string;
      child_columns: string[];
      parent_table: string;
      parent_columns: string[];
    }>(
      `SELECT con.conname AS constraint_name,
              child.relname AS child_table,
              ARRAY(SELECT att.attname::text FROM unnest(con.conkey) WITH ORDINALITY keys(attnum, ord)
                    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = keys.attnum
                    ORDER BY keys.ord)::text[] AS child_columns,
              parent.relname AS parent_table,
              ARRAY(SELECT att.attname::text FROM unnest(con.confkey) WITH ORDINALITY keys(attnum, ord)
                    JOIN pg_attribute att ON att.attrelid = con.confrelid AND att.attnum = keys.attnum
                    ORDER BY keys.ord)::text[] AS parent_columns
       FROM pg_constraint con
       JOIN pg_class child ON child.oid = con.conrelid
       JOIN pg_class parent ON parent.oid = con.confrelid
       JOIN pg_namespace namespace ON namespace.oid = child.relnamespace
       WHERE con.contype = 'f' AND namespace.nspname = 'public'`,
    );
    const foreignKeys: ForeignKey[] = fkResult.rows.map((row) => ({
      constraintName: row.constraint_name,
      childTable: row.child_table,
      childColumns: row.child_columns,
      parentTable: row.parent_table,
      parentColumns: row.parent_columns,
    }));

    let changed = true;
    while (changed) {
      changed = false;
      for (const foreignKey of foreignKeys) {
        const childRows = targetRows.get(foreignKey.childTable);
        const parentRows = targetRows.get(foreignKey.parentTable);
        if (!childRows || !parentRows) continue;

        const parentKeys = new Set(
          parentRows
            .map((row) => keyFor(row, foreignKey.parentColumns))
            .filter((key): key is string => key !== null),
        );
        const childColumns = columnsByTable
          .get(foreignKey.childTable)!
          .filter((column) => foreignKey.childColumns.includes(column.name));
        const canNull = childColumns.every((column) => column.nullable);
        const retained: Row[] = [];

        for (const row of childRows) {
          const childKey = keyFor(row, foreignKey.childColumns);
          if (childKey === null || parentKeys.has(childKey)) {
            retained.push(row);
            continue;
          }

          archive.push({
            sourceDatabase: requiredSqlitePath,
            sourceTable: foreignKey.childTable,
            sourceKey: sourceKey(row),
            reason: canNull
              ? `nulled broken reference ${foreignKey.constraintName}`
              : `quarantined broken reference ${foreignKey.constraintName}`,
            rowData: { ...row },
          });

          if (canNull) {
            for (const column of foreignKey.childColumns) row[column] = null;
            retained.push(row);
          }
          changed = true;
        }
        targetRows.set(foreignKey.childTable, retained);
      }
    }

    await client.query('BEGIN');
    await client.query('SET CONSTRAINTS ALL DEFERRED');

    const nonEmpty = await client.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         AND table_name NOT IN ('migrations', 'typeorm_metadata')
         AND (xpath('/row/count/text()', query_to_xml(
           format('SELECT count(*) AS count FROM %I', table_name), false, true, ''
         )))[1]::text::bigint > 0`,
    );
    const archiveCount = await client.query<{ count: string }>(
      'SELECT count(*)::text AS count FROM migration_archive.rows',
    );
    if (nonEmpty.rows.length > 0 || archiveCount.rows[0].count !== '0') {
      throw new Error(
        'Target PostgreSQL database is not empty; import aborted',
      );
    }

    for (const [table, rows] of targetRows) {
      const presentColumns = columnsByTable
        .get(table)!
        .filter((column) => rows.some((row) => row[column.name] !== undefined));
      await insertRows(client, table, presentColumns, rows);
      console.log(`${table}: imported ${rows.length}`);
    }

    if (targetRows.has('adk_events')) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('adk_events', 'sequence'),
                       COALESCE((SELECT max(sequence) FROM adk_events), 1),
                       EXISTS (SELECT 1 FROM adk_events))`,
      );
    }

    for (const archived of archive) {
      await client.query(
        `INSERT INTO migration_archive.rows
         (source_database, source_table, source_key, reason, row_data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          archived.sourceDatabase,
          archived.sourceTable,
          archived.sourceKey,
          archived.reason,
          archived.rowData,
        ],
      );
    }

    await client.query('SET CONSTRAINTS ALL IMMEDIATE');
    await client.query('COMMIT');
    console.log(`archive: preserved ${archive.length}`);
    console.log(`recovered context blocks: ${recoveredContextBlocks.size}`);
    console.log('SQLite to PostgreSQL migration committed successfully');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
