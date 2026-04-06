/*
Socket.IO transport for task events + activity publishing.

Goal: keep Socket.IO specifics here, expose a clean TasksTransport interface.
*/

import { io, Socket } from "socket.io-client";
import {
  TaskWireEvents,
  TaskCreatedWireEvent,
  TaskAssignedWireEvent,
  TaskStatusChangedWireEvent,
  TaskUpdatedWireEvent,
  TaskDeletedWireEvent,
  TaskCommentedWireEvent,
  TaskWirePayload,
  CommentWirePayload,
} from "@taico/events";

export type TaskEvent =
  | { type: "created"; actorId: string; task: TaskWirePayload }
  | { type: "updated"; actorId: string; task: TaskWirePayload }
  | { type: "deleted"; actorId: string; taskId: string }
  | { type: "assigned"; actorId: string; task: TaskWirePayload }
  | { type: "status_changed"; actorId: string; task: TaskWirePayload }
  | { type: "commented"; actorId: string; comment: CommentWirePayload };

export type TaskActivity = {
  taskId: string;
  kind?: string;
  message: string;
  ts: number;
};

export interface TasksTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  onTaskEvent(handler: (evt: TaskEvent) => void): void;
  publishActivity(activity: TaskActivity): void; // emits task.activity.post
}

type TasksSocketAck = unknown;

export class SocketIOTasksTransport implements TasksTransport {
  private socket?: Socket;
  private handlers: Array<(evt: TaskEvent) => void> = [];
  private started = false;
  private reconnectAttempts = 0;
  private subscribeAckTimer?: ReturnType<typeof setTimeout>;
  private awaitingSubscribeAck = false;

  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
    private readonly options?: {
      namespace?: string; // default: "/tasks"
      transports?: Array<"websocket" | "polling">; // default: ["websocket"]
      autoSubscribe?: boolean; // default: true
      debug?: boolean; // default: false
      reconnection?: boolean; // default: true
      reconnectionAttempts?: number; // default: Infinity (unlimited)
      reconnectionDelay?: number; // default: 1000ms
      reconnectionDelayMax?: number; // default: 5000ms
      randomizationFactor?: number; // default: 0.5
      subscribeAckTimeout?: number; // default: 5000ms
    }
  ) { }

  onTaskEvent(handler: (evt: TaskEvent) => void): void {
    this.handlers.push(handler);
  }

  publishActivity(activity: TaskActivity): void {
    if (!this.socket || !this.socket.connected) {
      if (this.options?.debug) {
        console.warn("[tasks] publishActivity called while disconnected", activity);
      }
      return;
    }

    this.socket.emit(
      TaskWireEvents.TASK_ACTIVITY_POST,
      activity,
      (ack: TasksSocketAck) => this.options?.debug && console.log(`[${TaskWireEvents.TASK_ACTIVITY_POST}] ack:`, ack)
    );
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const namespace = this.options?.namespace ?? "/tasks";
    const transports = this.options?.transports ?? ["websocket"];
    const autoSubscribe = this.options?.autoSubscribe ?? true;
    const reconnection = this.options?.reconnection ?? true;
    const reconnectionAttempts = this.options?.reconnectionAttempts ?? Infinity;
    const reconnectionDelay = this.options?.reconnectionDelay ?? 1000;
    const reconnectionDelayMax = this.options?.reconnectionDelayMax ?? 5000;
    const randomizationFactor = this.options?.randomizationFactor ?? 0.5;

    const url = `${this.baseUrl}${namespace}`;
    if (this.options?.debug) console.log(`[tasks] connecting to ${url}`);

    this.socket = io(url, {
      transports,
      auth: { token: this.accessToken },
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax,
      randomizationFactor,
    });

    // ----- lifecycle -----
    this.socket.on("connect", () => {
      if (this.reconnectAttempts > 0) {
        console.log(`[tasks] reconnected after ${this.reconnectAttempts} attempts:`, this.socket?.id);
      } else {
        if (this.options?.debug) console.log("[tasks] connected:", this.socket?.id);
      }

      // Reset reconnect attempts on successful connection
      this.reconnectAttempts = 0;

      if (autoSubscribe) {
        this.requestSubscribeAck();
      }
    });

    this.socket.on("disconnect", (reason) => {
      if (this.options?.debug) console.log("[tasks] disconnected:", reason);
      this.clearSubscribeAckTimer();
      this.awaitingSubscribeAck = false;

      // Only log reconnection info if we're going to try reconnecting
      if (reconnection && reason !== "io client disconnect") {
        console.log("[tasks] will attempt to reconnect...");
      }
    });

    this.socket.on("connect_error", (err: any) => {
      this.reconnectAttempts++;
      console.error(`[tasks] connect_error (attempt ${this.reconnectAttempts}):`, err?.message ?? err);
      if (this.options?.debug) console.error(err);
      this.clearSubscribeAckTimer();
      this.awaitingSubscribeAck = false;
    });

    this.socket.on("reconnect_attempt", (attemptNumber: number) => {
      if (this.options?.debug) console.log(`[tasks] reconnect_attempt ${attemptNumber}`);
    });

    this.socket.on("reconnect_failed", () => {
      console.error("[tasks] reconnect_failed: max reconnection attempts reached");
    });

    // ----- events we care about -----
    // Using shared wire event types from @taico/events
    // These types ensure consistency between backend emission and frontend/agent reception

    this.socket.on(TaskWireEvents.TASK_CREATED, (event: TaskCreatedWireEvent) =>
      this.emit({ type: "created", actorId: event.actor.id, task: event.payload })
    );
    this.socket.on(TaskWireEvents.TASK_ASSIGNED, (event: TaskAssignedWireEvent) =>
      this.emit({ type: "assigned", actorId: event.actor.id, task: event.payload })
    );
    this.socket.on(TaskWireEvents.TASK_STATUS_CHANGED, (event: TaskStatusChangedWireEvent) =>
      this.emit({ type: "status_changed", actorId: event.actor.id, task: event.payload })
    );
    this.socket.on(TaskWireEvents.TASK_UPDATED, (event: TaskUpdatedWireEvent) =>
      this.emit({ type: "updated", actorId: event.actor.id, task: event.payload })
    );
    this.socket.on(TaskWireEvents.TASK_DELETED, (event: TaskDeletedWireEvent) =>
      this.emit({ type: "deleted", actorId: event.actor.id, taskId: event.payload.taskId })
    );
    this.socket.on(TaskWireEvents.TASK_COMMENTED, (event: TaskCommentedWireEvent) =>
      this.emit({ type: "commented", actorId: event.actor.id, comment: event.payload })
    );

    // Wait until first connect or error so callers can await start()
    await new Promise<void>((resolve, reject) => {
      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onErr = (e: any) => {
        cleanup();
        // don't permanently kill the transport; just reject start()
        reject(e);
      };
      const cleanup = () => {
        this.socket?.off("connect", onConnect);
        this.socket?.off("connect_error", onErr);
      };

      this.socket?.once("connect", onConnect);
      this.socket?.once("connect_error", onErr);
    });
  }

  async stop(): Promise<void> {
    this.started = false;

    if (!this.socket) return;

    const s = this.socket;
    this.socket = undefined;

    // remove listeners to avoid leaks if restarted
    s.removeAllListeners();
    s.disconnect();
    this.clearSubscribeAckTimer();
    this.awaitingSubscribeAck = false;
  }

  private requestSubscribeAck() {
    if (!this.socket) return;

    const timeoutMs = this.options?.subscribeAckTimeout ?? 5000;
    const socket = this.socket;

    this.clearSubscribeAckTimer();
    this.awaitingSubscribeAck = true;

    socket.emit("tasks.subscribe", {}, (ack: TasksSocketAck) => {
      if (this.socket !== socket) return;
      this.awaitingSubscribeAck = false;
      this.clearSubscribeAckTimer();
      if (this.options?.debug) console.log("[tasks] subscribed:", ack);
    });

    this.subscribeAckTimer = setTimeout(() => {
      if (!this.socket || this.socket !== socket) return;
      if (!this.awaitingSubscribeAck) return;

      this.awaitingSubscribeAck = false;
      if (this.options?.debug) {
        console.warn("[tasks] subscribe ack timeout; forcing reconnect");
      }

      this.socket.disconnect();
      this.socket.connect();
    }, timeoutMs);
  }

  private clearSubscribeAckTimer() {
    if (this.subscribeAckTimer) {
      clearTimeout(this.subscribeAckTimer);
      this.subscribeAckTimer = undefined;
    }
  }

  private emit(evt: TaskEvent) {
    for (const h of this.handlers) {
      try {
        h(evt);
      } catch (err) {
        console.error("[tasks] handler error:", err);
      }
    }
  }
}
