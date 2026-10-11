import { INestApplicationContext, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/postgres-adapter';
import { Pool } from 'pg';
import { ServerOptions } from 'socket.io';
import { getConfig } from 'src/config/env.config';

/**
 * Relays socket.io broadcasts through Postgres so a client connected to one
 * backend process receives events emitted by any other.
 */
export class PostgresIoAdapter extends IoAdapter {
  private readonly logger = new Logger(PostgresIoAdapter.name);
  private readonly pool: Pool;
  private poolClosed = false;

  constructor(app: INestApplicationContext) {
    super(app);
    this.pool = new Pool({
      connectionString: getConfig().databaseUrl,
      ssl: getConfig().databaseSsl ? { rejectUnauthorized: true } : false,
      max: 4,
    });
    this.pool.on('error', (error) => {
      this.logger.warn({ message: 'Socket adapter pool error', error: error.message });
    });
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    server.adapter(
      createAdapter(this.pool, {
        errorHandler: (error: Error) => {
          this.logger.warn({ message: 'Socket adapter error', error: error.message });
        },
      }),
    );
    return server;
  }

  /** Creates the table the adapter uses for payloads too large for NOTIFY. */
  async prepare(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS socket_io_attachments (
         id bigserial UNIQUE,
         created_at timestamptz DEFAULT NOW(),
         payload bytea
       )`,
    );
  }

  async close(server: Parameters<IoAdapter['close']>[0]): Promise<void> {
    await super.close(server);
    if (!this.poolClosed) {
      this.poolClosed = true;
      await this.pool.end();
    }
  }
}
