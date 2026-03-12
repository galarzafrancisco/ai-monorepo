import {
  AppendEventRequest,
  BaseSessionService,
  CreateSessionRequest,
  DeleteSessionRequest,
  Event,
  GetSessionRequest,
  ListSessionsRequest,
  ListSessionsResponse,
  Session,
  State,
  createSession,
} from '@google/adk';
import * as sqlite3 from 'sqlite3';
import { randomUUID } from 'node:crypto';

type Sqlite3Module = typeof import('sqlite3');

const sqlite3Module =
  (sqlite3 as unknown as { default?: Sqlite3Module }).default ?? (sqlite3 as unknown as Sqlite3Module);

export interface SqliteSessionServiceOptions {
  filename?: string;
}

type SessionRow = {
  app_name: string;
  user_id: string;
  session_id: string;
  state_json: string;
  last_update_time: number;
};

type EventRow = {
  event_json: string;
};

type StateRow = {
  state_key: string;
  value_json: string;
};

export class SqliteSessionService extends BaseSessionService {
  private readonly db: sqlite3.Database;

  private readonly ready: Promise<void>;

  constructor(options: SqliteSessionServiceOptions = {}) {
    super();
    this.db = new sqlite3Module.Database(options.filename ?? ':memory:');
    this.ready = this.initialize();
  }

  async createSession({ appName, userId, state, sessionId }: CreateSessionRequest): Promise<Session> {
    await this.ready;
    const session = createSession({
      id: sessionId ?? randomUUID(),
      appName,
      userId,
      state: state ?? {},
      events: [],
      lastUpdateTime: Date.now(),
    });

    await this.run(
      'INSERT OR REPLACE INTO sessions (app_name, user_id, session_id, state_json, last_update_time) VALUES (?, ?, ?, ?, ?)',
      [appName, userId, session.id, JSON.stringify(session.state), session.lastUpdateTime],
    );

    return this.mergeState(session);
  }

  async getSession({ appName, userId, sessionId, config }: GetSessionRequest): Promise<Session | undefined> {
    await this.ready;
    const sessionRow = await this.get<SessionRow>(
      'SELECT app_name, user_id, session_id, state_json, last_update_time FROM sessions WHERE app_name = ? AND user_id = ? AND session_id = ?',
      [appName, userId, sessionId],
    );

    if (!sessionRow) {
      return undefined;
    }

    const eventRows = await this.all<EventRow>(
      'SELECT event_json FROM events WHERE app_name = ? AND user_id = ? AND session_id = ? ORDER BY sequence ASC',
      [appName, userId, sessionId],
    );

    let events = eventRows.map((row) => JSON.parse(row.event_json) as Event);
    if (config?.numRecentEvents) {
      events = events.slice(-config.numRecentEvents);
    }
    if (config?.afterTimestamp) {
      let index = events.length - 1;
      while (index >= 0) {
        if (events[index].timestamp < config.afterTimestamp) {
          break;
        }
        index -= 1;
      }
      if (index >= 0) {
        events = events.slice(index + 1);
      }
    }

    const session = createSession({
      id: sessionRow.session_id,
      appName: sessionRow.app_name,
      userId: sessionRow.user_id,
      state: JSON.parse(sessionRow.state_json) as Record<string, unknown>,
      events,
      lastUpdateTime: sessionRow.last_update_time,
    });

    return this.mergeState(session);
  }

  async listSessions({ appName, userId }: ListSessionsRequest): Promise<ListSessionsResponse> {
    await this.ready;
    const rows = await this.all<SessionRow>(
      'SELECT app_name, user_id, session_id, last_update_time FROM sessions WHERE app_name = ? AND user_id = ?',
      [appName, userId],
    );

    return {
      sessions: rows.map((row) =>
        createSession({
          id: row.session_id,
          appName: row.app_name,
          userId: row.user_id,
          state: {},
          events: [],
          lastUpdateTime: row.last_update_time,
        }),
      ),
    };
  }

  async deleteSession({ appName, userId, sessionId }: DeleteSessionRequest): Promise<void> {
    await this.ready;
    await this.run('DELETE FROM events WHERE app_name = ? AND user_id = ? AND session_id = ?', [appName, userId, sessionId]);
    await this.run('DELETE FROM sessions WHERE app_name = ? AND user_id = ? AND session_id = ?', [appName, userId, sessionId]);
  }

  async appendEvent({ session, event }: AppendEventRequest): Promise<Event> {
    await this.ready;
    await super.appendEvent({ session, event });
    session.lastUpdateTime = event.timestamp;

    const storedSession = await this.get<SessionRow>(
      'SELECT state_json FROM sessions WHERE app_name = ? AND user_id = ? AND session_id = ?',
      [session.appName, session.userId, session.id],
    );

    if (!storedSession) {
      return event;
    }

    let storedState = JSON.parse(storedSession.state_json) as Record<string, unknown>;
    if (!event.partial && event.actions?.stateDelta) {
      for (const [key, value] of Object.entries(event.actions.stateDelta)) {
        if (!key.startsWith(State.TEMP_PREFIX)) {
          storedState[key] = value;
        }
      }

      await this.persistScopedState(session.appName, session.userId, event.actions.stateDelta);
    }

    await this.run(
      'UPDATE sessions SET state_json = ?, last_update_time = ? WHERE app_name = ? AND user_id = ? AND session_id = ?',
      [JSON.stringify(storedState), event.timestamp, session.appName, session.userId, session.id],
    );

    if (!event.partial) {
      await this.run(
        'INSERT INTO events (app_name, user_id, session_id, event_id, timestamp, event_json) VALUES (?, ?, ?, ?, ?, ?)',
        [session.appName, session.userId, session.id, event.id, event.timestamp, JSON.stringify(event)],
      );
    }

    return event;
  }

  async close(): Promise<void> {
    await this.ready;
    await new Promise<void>((resolve, reject) => {
      this.db.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async initialize(): Promise<void> {
    await this.run('PRAGMA foreign_keys = ON');

    await this.run(
      `CREATE TABLE IF NOT EXISTS sessions (
        app_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        state_json TEXT NOT NULL,
        last_update_time INTEGER NOT NULL,
        PRIMARY KEY (app_name, user_id, session_id)
      )`,
    );

    await this.run(
      `CREATE TABLE IF NOT EXISTS events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        app_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        event_json TEXT NOT NULL,
        FOREIGN KEY (app_name, user_id, session_id)
          REFERENCES sessions (app_name, user_id, session_id)
          ON DELETE CASCADE
      )`,
    );

    await this.run(
      `CREATE TABLE IF NOT EXISTS app_state (
        app_name TEXT NOT NULL,
        state_key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        PRIMARY KEY (app_name, state_key)
      )`,
    );

    await this.run(
      `CREATE TABLE IF NOT EXISTS user_state (
        app_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        state_key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        PRIMARY KEY (app_name, user_id, state_key)
      )`,
    );
  }

  private async mergeState(session: Session): Promise<Session> {
    const merged = createSession({
      id: session.id,
      appName: session.appName,
      userId: session.userId,
      state: this.cloneState(session.state),
      events: session.events,
      lastUpdateTime: session.lastUpdateTime,
    });

    const appRows = await this.all<StateRow>('SELECT state_key, value_json FROM app_state WHERE app_name = ?', [session.appName]);
    for (const row of appRows) {
      merged.state[`${State.APP_PREFIX}${row.state_key}`] = JSON.parse(row.value_json) as unknown;
    }

    const userRows = await this.all<StateRow>(
      'SELECT state_key, value_json FROM user_state WHERE app_name = ? AND user_id = ?',
      [session.appName, session.userId],
    );
    for (const row of userRows) {
      merged.state[`${State.USER_PREFIX}${row.state_key}`] = JSON.parse(row.value_json) as unknown;
    }

    return merged;
  }

  private async persistScopedState(
    appName: string,
    userId: string,
    delta: Record<string, unknown>,
  ): Promise<void> {
    const entries = Object.entries(delta);
    for (const [key, value] of entries) {
      if (key.startsWith(State.APP_PREFIX)) {
        await this.run(
          'INSERT INTO app_state (app_name, state_key, value_json) VALUES (?, ?, ?) ON CONFLICT(app_name, state_key) DO UPDATE SET value_json = excluded.value_json',
          [appName, key.replace(State.APP_PREFIX, ''), JSON.stringify(value)],
        );
      }

      if (key.startsWith(State.USER_PREFIX)) {
        await this.run(
          'INSERT INTO user_state (app_name, user_id, state_key, value_json) VALUES (?, ?, ?, ?) ON CONFLICT(app_name, user_id, state_key) DO UPDATE SET value_json = excluded.value_json',
          [appName, userId, key.replace(State.USER_PREFIX, ''), JSON.stringify(value)],
        );
      }
    }
  }

  private cloneState(state: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  }

  private run(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get<T>(sql, params, (error, row) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(row ?? undefined);
      });
    });
  }

  private all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all<T>(sql, params, (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows);
      });
    });
  }
}
