import { DataSource } from 'typeorm';
import { HardDeleteSoftDeletedThreads1743100000000 } from './1743100000000-HardDeleteSoftDeletedThreads';

describe('HardDeleteSoftDeletedThreads1743100000000', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
    await dataSource.query('PRAGMA foreign_keys = ON');

    await dataSource.query('CREATE TABLE actors (id TEXT PRIMARY KEY)');
    await dataSource.query('CREATE TABLE tasks (id TEXT PRIMARY KEY)');
    await dataSource.query('CREATE TABLE context_blocks (id TEXT PRIMARY KEY)');
    await dataSource.query('CREATE TABLE tags (id TEXT PRIMARY KEY)');
    await dataSource.query(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY,
        created_by_actor_id TEXT NOT NULL,
        parent_task_id TEXT,
        state_context_block_id TEXT NOT NULL,
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
        FOREIGN KEY (state_context_block_id) REFERENCES context_blocks(id) ON DELETE RESTRICT
      )
    `);
    await dataSource.query(`
      CREATE TABLE thread_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE
      )
    `);
    await dataSource.query(`
      CREATE TABLE thread_tasks (
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);
    await dataSource.query(`
      CREATE TABLE thread_context_blocks (
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        context_block_id TEXT NOT NULL REFERENCES context_blocks(id) ON DELETE CASCADE
      )
    `);
    await dataSource.query(`
      CREATE TABLE thread_tags (
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE
      )
    `);
    await dataSource.query(`
      CREATE TABLE thread_participants (
        thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        actor_id TEXT NOT NULL REFERENCES actors(id) ON DELETE CASCADE
      )
    `);

    await dataSource.query("INSERT INTO actors (id) VALUES ('actor')");
    await dataSource.query("INSERT INTO tasks (id) VALUES ('task')");
    await dataSource.query("INSERT INTO context_blocks (id) VALUES ('legacy-block'), ('active-block')");
    await dataSource.query("INSERT INTO tags (id) VALUES ('tag')");
    await dataSource.query(`
      INSERT INTO threads (id, created_by_actor_id, parent_task_id, state_context_block_id, deleted_at)
      VALUES ('legacy-thread', 'actor', 'task', 'legacy-block', datetime('now')),
             ('active-thread', 'actor', 'task', 'active-block', NULL)
    `);

    for (const threadId of ['legacy-thread', 'active-thread']) {
      await dataSource.query(`INSERT INTO thread_messages (id, thread_id) VALUES (?, ?)`, [
        `${threadId}-message`,
        threadId,
      ]);
      await dataSource.query(
        'INSERT INTO thread_tasks (thread_id, task_id) VALUES (?, ?)',
        [threadId, 'task'],
      );
      await dataSource.query(
        'INSERT INTO thread_context_blocks (thread_id, context_block_id) VALUES (?, ?)',
        [threadId, 'active-block'],
      );
      await dataSource.query(
        'INSERT INTO thread_tags (thread_id, tag_id) VALUES (?, ?)',
        [threadId, 'tag'],
      );
      await dataSource.query(
        'INSERT INTO thread_participants (thread_id, actor_id) VALUES (?, ?)',
        [threadId, 'actor'],
      );
    }
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('purges legacy soft-deleted threads and releases their state blocks', async () => {
    const migration = new HardDeleteSoftDeletedThreads1743100000000();
    await migration.up(dataSource.createQueryRunner());

    await dataSource.query("DELETE FROM context_blocks WHERE id = 'legacy-block'");
    await expect(dataSource.query("DELETE FROM context_blocks WHERE id = 'active-block'")).rejects.toThrow();

    for (const table of [
      'threads',
      'thread_messages',
      'thread_tasks',
      'thread_context_blocks',
      'thread_tags',
      'thread_participants',
    ]) {
      const [row] = (await dataSource.query(
        `SELECT COUNT(*) AS count FROM ${table} WHERE ${table === 'threads' ? 'id' : 'thread_id'} = 'legacy-thread'`,
      )) as Array<{ count: number }>;
      expect(row.count).toBe(0);
    }

    const [activeThread] = (await dataSource.query(
      "SELECT id FROM threads WHERE id = 'active-thread'",
    )) as Array<{ id: string }>;
    expect(activeThread.id).toBe('active-thread');
  });
});
