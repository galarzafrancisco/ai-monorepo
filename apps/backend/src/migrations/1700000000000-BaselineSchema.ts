import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline migration that captures the full current schema.
 *
 * Uses CREATE TABLE IF NOT EXISTS so it's safe to run on both:
 * - Fresh databases (creates everything)
 * - Existing databases previously managed by synchronize: true (no-ops)
 *
 * This replaces the previous synchronize: true approach and consolidates
 * all prior incremental migrations into a single baseline.
 */
export class BaselineSchema1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Identity & Auth ──────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS actors (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        introduction TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now'))
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        passwordHash TEXT NOT NULL,
        actor_id TEXT UNIQUE,
        isActive INTEGER NOT NULL DEFAULT 1,
        role VARCHAR NOT NULL DEFAULT 'standard',
        rowVersion INTEGER NOT NULL DEFAULT 1,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS jwks_keys (
        id TEXT PRIMARY KEY,
        kid TEXT NOT NULL UNIQUE,
        public_key_pem TEXT NOT NULL,
        private_key_pem TEXT NOT NULL,
        algorithm TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        expires_at DATETIME NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME
      )
    `);

    // ── Meta ──────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        color TEXT,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        tagId TEXT UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        repoUrl TEXT,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (tagId) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // ── Tasks ─────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'not_started',
        assignee_actor_id TEXT,
        session_id TEXT,
        created_by_actor_id TEXT NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (assignee_actor_id) REFERENCES actors(id),
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        commenter_actor_id TEXT,
        content TEXT NOT NULL,
        task_id TEXT NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (commenter_actor_id) REFERENCES actors(id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS artefacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        link TEXT NOT NULL,
        task_id TEXT NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_input_requests (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        asked_by_actor_id TEXT NOT NULL,
        assigned_to_actor_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT,
        resolved_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (asked_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (assigned_to_actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT NOT NULL,
        depends_on_task_id TEXT NOT NULL,
        PRIMARY KEY (task_id, depends_on_task_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (depends_on_task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS task_tags (
        task_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (task_id, tag_id),
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // ── Context Blocks ────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS context_blocks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        parent_id TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_by_actor_id TEXT NOT NULL,
        assignee_actor_id TEXT,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (parent_id) REFERENCES context_blocks(id),
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (assignee_actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_context_blocks_parent_order
        ON context_blocks(parent_id, "order")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS context_block_tags (
        block_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (block_id, tag_id),
        FOREIGN KEY (block_id) REFERENCES context_blocks(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    // ── Threads ───────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_by_actor_id TEXT NOT NULL,
        parent_task_id TEXT NOT NULL,
        state_context_block_id TEXT NOT NULL,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (created_by_actor_id) REFERENCES actors(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id),
        FOREIGN KEY (state_context_block_id) REFERENCES context_blocks(id) ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_parent_task_id
        ON threads(parent_task_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_threads_state_context_block_id
        ON threads(state_context_block_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS thread_tasks (
        thread_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, task_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS thread_context_blocks (
        thread_id TEXT NOT NULL,
        context_block_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, context_block_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (context_block_id) REFERENCES context_blocks(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS thread_tags (
        thread_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, tag_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS thread_participants (
        thread_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        PRIMARY KEY (thread_id, actor_id),
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (actor_id) REFERENCES actors(id) ON DELETE CASCADE
      )
    `);

    // ── Agents ────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL DEFAULT 'claude',
        description TEXT,
        system_prompt TEXT NOT NULL,
        provider_id TEXT,
        model_id TEXT,
        status_triggers TEXT NOT NULL DEFAULT '',
        tag_triggers TEXT NOT NULL DEFAULT '',
        allowed_tools TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        concurrency_limit INTEGER,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id)
      )
    `);

    // ── Agent Runs ────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        parent_task_id TEXT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        started_at DATETIME,
        ended_at DATETIME,
        last_ping DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id),
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id)
      )
    `);

    // ── Authorization Server ──────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS registered_clients (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL UNIQUE,
        client_secret TEXT,
        client_name TEXT NOT NULL,
        redirect_uris TEXT NOT NULL,
        grant_types TEXT NOT NULL,
        token_endpoint_auth_method TEXT NOT NULL,
        scopes TEXT,
        contacts TEXT,
        row_version INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS issued_access_tokens (
        id TEXT PRIMARY KEY,
        subject_actor_id TEXT NOT NULL,
        issued_by_actor_id TEXT NOT NULL,
        jti TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        scopes TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        last_used_at DATETIME,
        FOREIGN KEY (subject_actor_id) REFERENCES actors(id) ON DELETE CASCADE,
        FOREIGN KEY (issued_by_actor_id) REFERENCES actors(id) ON DELETE CASCADE
      )
    `);

    // ── MCP Registry ──────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        providedId VARCHAR(255) UNIQUE,
        name VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        url VARCHAR(2048),
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mcp_connections (
        id TEXT PRIMARY KEY,
        serverId TEXT NOT NULL,
        friendlyName VARCHAR(255) NOT NULL,
        providedId VARCHAR(255) UNIQUE,
        clientId VARCHAR(500) NOT NULL,
        clientSecret TEXT NOT NULL,
        authorizeUrl TEXT NOT NULL,
        tokenUrl TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME,
        FOREIGN KEY (serverId) REFERENCES mcp_servers(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mcp_scopes (
        id VARCHAR(255) NOT NULL,
        serverId TEXT NOT NULL,
        description TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME,
        PRIMARY KEY (id, serverId),
        FOREIGN KEY (serverId) REFERENCES mcp_servers(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mcp_scope_mappings (
        id TEXT PRIMARY KEY,
        scopeId VARCHAR(255) NOT NULL,
        serverId TEXT NOT NULL,
        connectionId TEXT NOT NULL,
        downstreamScope VARCHAR(255) NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT (datetime('now')),
        updatedAt DATETIME NOT NULL DEFAULT (datetime('now')),
        deletedAt DATETIME,
        FOREIGN KEY (serverId) REFERENCES mcp_servers(id),
        FOREIGN KEY (connectionId) REFERENCES mcp_connections(id) ON DELETE CASCADE,
        FOREIGN KEY (scopeId, serverId) REFERENCES mcp_scopes(id, serverId),
        UNIQUE (scopeId, serverId, connectionId, downstreamScope)
      )
    `);

    // ── Auth Journeys ─────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS authorization_journeys (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'not_started',
        actor_id TEXT,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        deleted_at DATETIME,
        FOREIGN KEY (actor_id) REFERENCES actors(id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mcp_authorization_flows (
        id TEXT PRIMARY KEY,
        authorization_journey_id TEXT NOT NULL,
        server_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'client_not_registered',
        code_challenge TEXT,
        code_challenge_method VARCHAR(10),
        state TEXT,
        redirect_uri TEXT,
        scopes TEXT,
        resource TEXT,
        authorization_code TEXT,
        authorization_code_expires_at DATETIME,
        authorization_code_used INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (authorization_journey_id) REFERENCES authorization_journeys(id),
        FOREIGN KEY (server_id) REFERENCES mcp_servers(id) ON DELETE RESTRICT,
        FOREIGN KEY (client_id) REFERENCES registered_clients(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS mcp_refresh_tokens (
        id TEXT PRIMARY KEY,
        mcp_authorization_flow_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        client_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        revoked_at DATETIME,
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (mcp_authorization_flow_id) REFERENCES mcp_authorization_flows(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS connection_authorization_flows (
        id TEXT PRIMARY KEY,
        authorization_journey_id TEXT NOT NULL,
        mcp_connection_id TEXT,
        state VARCHAR(255),
        authorization_code VARCHAR(500),
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at DATETIME,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL DEFAULT (datetime('now')),
        updated_at DATETIME NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (authorization_journey_id) REFERENCES authorization_journeys(id) ON DELETE CASCADE,
        FOREIGN KEY (mcp_connection_id) REFERENCES mcp_connections(id) ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order
    const tables = [
      'connection_authorization_flows',
      'mcp_refresh_tokens',
      'mcp_authorization_flows',
      'authorization_journeys',
      'mcp_scope_mappings',
      'mcp_scopes',
      'mcp_connections',
      'mcp_servers',
      'issued_access_tokens',
      'refresh_tokens',
      'registered_clients',
      'agent_runs',
      'agents',
      'thread_participants',
      'thread_tags',
      'thread_context_blocks',
      'thread_tasks',
      'threads',
      'context_block_tags',
      'context_blocks',
      'task_tags',
      'task_dependencies',
      'task_input_requests',
      'artefacts',
      'comments',
      'tasks',
      'projects',
      'tags',
      'jwks_keys',
      'users',
      'actors',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}"`);
    }
  }
}
