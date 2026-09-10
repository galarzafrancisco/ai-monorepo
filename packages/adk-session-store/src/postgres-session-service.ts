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
} from "@google/adk";
import { randomUUID } from "node:crypto";
import { Pool, QueryResultRow } from "pg";

export interface PostgresSessionServiceOptions {
  connectionString: string;
  ssl?: boolean;
}

type SessionRow = QueryResultRow & {
  app_name: string;
  user_id: string;
  session_id: string;
  state_json: unknown;
  last_update_time: string | number;
};

type EventRow = QueryResultRow & { event_json: unknown };
type StateRow = QueryResultRow & { state_key: string; value_json: unknown };

export class PostgresSessionService extends BaseSessionService {
  private readonly pool: Pool;
  private readonly ready: Promise<void>;

  constructor(options: PostgresSessionServiceOptions) {
    super();
    this.pool = new Pool({
      connectionString: options.connectionString,
      ssl: options.ssl ? { rejectUnauthorized: true } : false,
    });
    this.ready = this.initialize();
  }

  async createSession({
    appName,
    userId,
    state,
    sessionId,
  }: CreateSessionRequest): Promise<Session> {
    await this.ready;
    const session = createSession({
      id: sessionId ?? randomUUID(),
      appName,
      userId,
      state: state ?? {},
      events: [],
      lastUpdateTime: Date.now(),
    });

    await this.pool.query(
      `INSERT INTO adk_sessions (app_name, user_id, session_id, state_json, last_update_time)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (app_name, user_id, session_id) DO UPDATE SET
         state_json = EXCLUDED.state_json,
         last_update_time = EXCLUDED.last_update_time`,
      [
        appName,
        userId,
        session.id,
        JSON.stringify(session.state),
        session.lastUpdateTime,
      ],
    );
    return this.mergeState(session);
  }

  async getSession({
    appName,
    userId,
    sessionId,
    config,
  }: GetSessionRequest): Promise<Session | undefined> {
    await this.ready;
    const sessionRow = await this.one<SessionRow>(
      `SELECT app_name, user_id, session_id, state_json, last_update_time
       FROM adk_sessions WHERE app_name = $1 AND user_id = $2 AND session_id = $3`,
      [appName, userId, sessionId],
    );
    if (!sessionRow) return undefined;

    const eventRows = await this.many<EventRow>(
      `SELECT event_json FROM adk_events
       WHERE app_name = $1 AND user_id = $2 AND session_id = $3 ORDER BY sequence ASC`,
      [appName, userId, sessionId],
    );
    let events = eventRows.map((row) => this.parseJson<Event>(row.event_json));
    if (config?.numRecentEvents) events = events.slice(-config.numRecentEvents);
    if (config?.afterTimestamp) {
      let index = events.length - 1;
      while (index >= 0 && events[index].timestamp >= config.afterTimestamp)
        index -= 1;
      if (index >= 0) events = events.slice(index + 1);
    }

    return this.mergeState(
      createSession({
        id: sessionRow.session_id,
        appName: sessionRow.app_name,
        userId: sessionRow.user_id,
        state: this.parseJson<Record<string, unknown>>(sessionRow.state_json),
        events,
        lastUpdateTime: Number(sessionRow.last_update_time),
      }),
    );
  }

  async listSessions({
    appName,
    userId,
  }: ListSessionsRequest): Promise<ListSessionsResponse> {
    await this.ready;
    const rows = await this.many<SessionRow>(
      `SELECT app_name, user_id, session_id, state_json, last_update_time
       FROM adk_sessions WHERE app_name = $1 AND user_id = $2`,
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
          lastUpdateTime: Number(row.last_update_time),
        }),
      ),
    };
  }

  async deleteSession({
    appName,
    userId,
    sessionId,
  }: DeleteSessionRequest): Promise<void> {
    await this.ready;
    await this.pool.query(
      "DELETE FROM adk_sessions WHERE app_name = $1 AND user_id = $2 AND session_id = $3",
      [appName, userId, sessionId],
    );
  }

  async appendEvent({ session, event }: AppendEventRequest): Promise<Event> {
    await this.ready;
    await super.appendEvent({ session, event });
    session.lastUpdateTime = event.timestamp;
    const stored = await this.one<SessionRow>(
      `SELECT app_name, user_id, session_id, state_json, last_update_time
       FROM adk_sessions WHERE app_name = $1 AND user_id = $2 AND session_id = $3`,
      [session.appName, session.userId, session.id],
    );
    if (!stored) return event;

    const storedState = this.parseJson<Record<string, unknown>>(
      stored.state_json,
    );
    if (!event.partial && event.actions?.stateDelta) {
      for (const [key, value] of Object.entries(event.actions.stateDelta)) {
        if (!key.startsWith(State.TEMP_PREFIX)) storedState[key] = value;
      }
      await this.persistScopedState(
        session.appName,
        session.userId,
        event.actions.stateDelta,
      );
    }

    await this.pool.query(
      `UPDATE adk_sessions SET state_json = $1::jsonb, last_update_time = $2
       WHERE app_name = $3 AND user_id = $4 AND session_id = $5`,
      [
        JSON.stringify(storedState),
        event.timestamp,
        session.appName,
        session.userId,
        session.id,
      ],
    );
    if (!event.partial) {
      await this.pool.query(
        `INSERT INTO adk_events (app_name, user_id, session_id, event_id, timestamp, event_json)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          session.appName,
          session.userId,
          session.id,
          event.id,
          event.timestamp,
          JSON.stringify(event),
        ],
      );
    }
    return event;
  }

  async close(): Promise<void> {
    await this.ready;
    await this.pool.end();
  }

  private async initialize(): Promise<void> {
    await this.pool.query("SELECT 1");
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
    const appRows = await this.many<StateRow>(
      "SELECT state_key, value_json FROM adk_app_state WHERE app_name = $1",
      [session.appName],
    );
    for (const row of appRows) {
      merged.state[`${State.APP_PREFIX}${row.state_key}`] = this.parseJson(
        row.value_json,
      );
    }
    const userRows = await this.many<StateRow>(
      "SELECT state_key, value_json FROM adk_user_state WHERE app_name = $1 AND user_id = $2",
      [session.appName, session.userId],
    );
    for (const row of userRows) {
      merged.state[`${State.USER_PREFIX}${row.state_key}`] = this.parseJson(
        row.value_json,
      );
    }
    return merged;
  }

  private async persistScopedState(
    appName: string,
    userId: string,
    delta: Record<string, unknown>,
  ): Promise<void> {
    for (const [key, value] of Object.entries(delta)) {
      if (key.startsWith(State.APP_PREFIX)) {
        await this.pool.query(
          `INSERT INTO adk_app_state (app_name, state_key, value_json) VALUES ($1, $2, $3::jsonb)
           ON CONFLICT (app_name, state_key) DO UPDATE SET value_json = EXCLUDED.value_json`,
          [appName, key.replace(State.APP_PREFIX, ""), JSON.stringify(value)],
        );
      }
      if (key.startsWith(State.USER_PREFIX)) {
        await this.pool.query(
          `INSERT INTO adk_user_state (app_name, user_id, state_key, value_json) VALUES ($1, $2, $3, $4::jsonb)
           ON CONFLICT (app_name, user_id, state_key) DO UPDATE SET value_json = EXCLUDED.value_json`,
          [
            appName,
            userId,
            key.replace(State.USER_PREFIX, ""),
            JSON.stringify(value),
          ],
        );
      }
    }
  }

  private parseJson<T>(value: unknown): T {
    return (typeof value === "string" ? JSON.parse(value) : value) as T;
  }

  private cloneState(state: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  }

  private async one<T extends QueryResultRow>(
    sql: string,
    params: unknown[],
  ): Promise<T | undefined> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows[0];
  }

  private async many<T extends QueryResultRow>(
    sql: string,
    params: unknown[],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(sql, params);
    return result.rows;
  }
}
