import { ApiClient } from '@taico/client/v2';
import { ExecutionWireEvents, TaskWireEvents, WorkerWireEvents } from '@taico/events';
import { io, type Socket } from 'socket.io-client';
import { DisplayAuth } from './auth.js';
import { BleDisplay, type DisplaySnapshot } from './ble-display.js';

const RETRY_DELAY_MS = 5_000;
const TOKEN_REFRESH_SKEW_MS = 60_000;
const SNAPSHOT_REFRESH_MS = 60_000;
const EVENT_DEBOUNCE_MS = 250;

export type DisplayOptions = {
  serverUrl: string;
  deviceName: string;
  credentialsPath?: string;
};

export async function startDisplayApp(options: DisplayOptions): Promise<void> {
  const serverUrl = options.serverUrl.replace(/\/+$/, '');
  const auth = new DisplayAuth(serverUrl, options.credentialsPath);
  const display = new BleDisplay(options.deviceName);

  console.log(`[display] Starting against ${serverUrl}.`);
  display.start();
  await authenticateForever(auth);

  const client = new ApiClient({
    baseUrl: serverUrl,
    getAccessToken: () => auth.getAccessToken(),
  });
  const dashboard = new Dashboard(client, display);
  dashboard.start();

  const notifier = new TaicoSocketNotifier(serverUrl, auth, () => dashboard.refresh());
  notifier.start();
}

class Dashboard {
  private refreshInProgress = false;
  private refreshRequested = false;

  constructor(
    private readonly client: ApiClient,
    private readonly display: BleDisplay,
  ) {}

  start(): void {
    void this.refresh();
    setInterval(() => void this.refresh(), SNAPSHOT_REFRESH_MS);
  }

  async refresh(): Promise<void> {
    if (this.refreshInProgress) {
      this.refreshRequested = true;
      return;
    }

    this.refreshInProgress = true;
    try {
      const [tasks, workers, activeExecutions] = await Promise.all([
        this.client.task.TasksController_listTasks({ page: 1, limit: 100 }),
        this.client.workers.WorkersController_listWorkers(),
        this.client.executions.ActiveTaskExecutionController_listActiveExecutions({
          page: 1,
          limit: 100,
        }),
      ]);

      this.display.update({
        ...countTasks(tasks.items),
        workers: workers.length,
        active: activeExecutions.total,
      });
    } catch (error) {
      console.warn(
        `[display] Snapshot refresh failed: ${message(error)}. Retrying in 5 seconds.`,
      );
      setTimeout(() => void this.refresh(), RETRY_DELAY_MS);
    } finally {
      this.refreshInProgress = false;

      if (this.refreshRequested) {
        this.refreshRequested = false;
        void this.refresh();
      }
    }
  }
}

class TaicoSocketNotifier {
  private sockets: Socket[] = [];
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private tokenTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnecting = false;

  constructor(
    private readonly serverUrl: string,
    private readonly auth: DisplayAuth,
    private readonly onChange: () => Promise<void>,
  ) {}

  start(): void {
    void this.connect();
  }

  private async connect(): Promise<void> {
    if (this.reconnecting) {
      return;
    }

    this.reconnecting = true;
    try {
      const token = await this.auth.getAccessToken();
      this.disconnectSockets();
      this.connectNamespace('/tasks', token, [
        TaskWireEvents.TASK_CREATED,
        TaskWireEvents.TASK_UPDATED,
        TaskWireEvents.TASK_DELETED,
        TaskWireEvents.TASK_ASSIGNED,
        TaskWireEvents.TASK_STATUS_CHANGED,
      ]);
      this.connectNamespace('/workers', token, [WorkerWireEvents.WORKER_SEEN]);
      this.connectNamespace('/executions', token, [
        ExecutionWireEvents.EXECUTIONS_CHANGED,
      ]);
      await this.scheduleTokenRefresh();
    } catch (error) {
      console.warn(
        `[display] WebSocket authentication failed: ${message(error)}. Retrying in 5 seconds.`,
      );
      this.scheduleReconnect();
    } finally {
      this.reconnecting = false;
    }
  }

  private connectNamespace(
    namespace: string,
    token: string,
    events: readonly string[],
  ): void {
    const socket = io(`${this.serverUrl}${namespace}`, {
      transports: ['websocket'],
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: RETRY_DELAY_MS,
    });

    socket.on('connect', () => {
      socket.emit(`${namespace.slice(1)}.subscribe`, (response: { ok?: boolean }) => {
        if (!response?.ok) {
          console.warn(`[display] Failed to subscribe to ${namespace}.`);
          return;
        }
        console.log(`[display] Subscribed to ${namespace}.`);
        this.scheduleRefresh('connected');
      });
    });
    socket.on('connect_error', (error) => {
      if (isAuthError(error)) {
        void this.reconnectWithFreshToken();
      }
    });
    for (const event of events) {
      socket.on(event, () => this.scheduleRefresh(event));
    }
    this.sockets.push(socket);
  }

  private scheduleRefresh(reason: string): void {
    if (this.refreshTimer) {
      return;
    }

    this.refreshTimer = setTimeout(() => {
      this.refreshTimer = null;
      console.log(`[display] Refreshing after ${reason}.`);
      void this.onChange();
    }, EVENT_DEBOUNCE_MS);
  }

  private async scheduleTokenRefresh(): Promise<void> {
    if (this.tokenTimer) {
      clearTimeout(this.tokenTimer);
    }

    const expiresAt = await this.auth.getExpiresAt();
    const delay = Math.max(
      0,
      Date.parse(expiresAt) - Date.now() - TOKEN_REFRESH_SKEW_MS,
    );
    this.tokenTimer = setTimeout(() => {
      void this.reconnectWithFreshToken();
    }, delay);
  }

  private async reconnectWithFreshToken(): Promise<void> {
    try {
      await this.auth.refreshAccessToken();
      await this.connect();
    } catch (error) {
      console.warn(`[display] Token refresh failed: ${message(error)}.`);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RETRY_DELAY_MS);
  }

  private disconnectSockets(): void {
    for (const socket of this.sockets) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    this.sockets = [];
  }
}

function countTasks(tasks: Array<{ status: string }>): Omit<DisplaySnapshot, 'workers' | 'active'> {
  const counts = { todo: 0, doing: 0, review: 0, done: 0 };
  for (const task of tasks) {
    switch (task.status) {
      case 'NOT_STARTED':
        counts.todo += 1;
        break;
      case 'IN_PROGRESS':
        counts.doing += 1;
        break;
      case 'FOR_REVIEW':
        counts.review += 1;
        break;
      case 'DONE':
        counts.done += 1;
        break;
    }
  }
  return counts;
}

async function authenticateForever(auth: DisplayAuth): Promise<void> {
  while (true) {
    try {
      await auth.getCredentials();
      return;
    } catch (error) {
      console.warn(
        `[display] Authentication unavailable: ${message(error)}. Retrying in 5 seconds.`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAuthError(error: Error): boolean {
  return /401|403|unauthori[sz]ed|forbidden|token/i.test(error.message);
}
