/*
Socket.IO transport for task events + activity publishing.

Goal: keep Socket.IO specifics here, expose a clean TasksTransport interface.
*/

import { io, Socket } from "socket.io-client";
import { CommentEntity } from "../../backend/src/tasks/comment.entity.js";
import { TaskEntity } from "../../backend/src/tasks/task.entity.js";
import { EventActor } from "../../backend/src/tasks/events/tasks.events.js";

export type TaskEvent =
  | { type: "created"; actorId: string; task: TaskEntity }
  | { type: "updated"; actorId: string; task: TaskEntity }
  | { type: "deleted"; actorId: string; taskId: string }
  | { type: "assigned"; actorId: string; task: TaskEntity }
  | { type: "status_changed"; actorId: string; task: TaskEntity }
  | { type: "commented"; actorId: string; comment: CommentEntity };

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
      "task.activity.post",
      activity,
      (ack: TasksSocketAck) => this.options?.debug && console.log("[task.activity.post] ack:", ack)
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
        this.socket?.emit("tasks.subscribe", {}, (ack: TasksSocketAck) => {
          if (this.options?.debug) console.log("[tasks] subscribed:", ack);
        });
      }
    });

    this.socket.on("disconnect", (reason) => {
      if (this.options?.debug) console.log("[tasks] disconnected:", reason);

      // Only log reconnection info if we're going to try reconnecting
      if (reconnection && reason !== "io client disconnect") {
        console.log("[tasks] will attempt to reconnect...");
      }
    });

    this.socket.on("connect_error", (err: any) => {
      this.reconnectAttempts++;
      console.error(`[tasks] connect_error (attempt ${this.reconnectAttempts}):`, err?.message ?? err);
      if (this.options?.debug) console.error(err);
    });

    this.socket.on("reconnect_attempt", (attemptNumber: number) => {
      if (this.options?.debug) console.log(`[tasks] reconnect_attempt ${attemptNumber}`);
    });

    this.socket.on("reconnect_failed", () => {
      console.error("[tasks] reconnect_failed: max reconnection attempts reached");
    });

    // ----- events we care about -----
    // this.socket.on("task.created", (task: TaskEntity) => this.emit({ type: "created", task }));
    // this.socket.on("task.assigned", (task: TaskEntity) => this.emit({ type: "assigned", task }));
    // this.socket.on("task.status_changed", (task: TaskEntity) => this.emit({ type: "status_changed", task }));
    // this.socket.on("task.updated", (task: TaskEntity) => this.emit({ type: "updated", task }));

    this.socket.on("task.created", (task: TaskEntity, actor: EventActor) =>
      this.emit({ type: "created", actorId: actor.id, task })
    );
    this.socket.on("task.assigned", (task: TaskEntity, actor: EventActor) =>
      this.emit({ type: "assigned", actorId: actor.id, task })
    );
    this.socket.on("task.status_changed", (task: TaskEntity, actor: EventActor) =>
      this.emit({ type: "status_changed", actorId: actor.id, task })
    );
    this.socket.on("task.updated", (task: TaskEntity, actor: EventActor) =>
      this.emit({ type: "updated", actorId: actor.id, task })
    );
    this.socket.on("task.deleted", ({taskId}: {taskId: string}, actor: EventActor) =>
      this.emit({ type: "deleted", actorId: actor.id, taskId })
    );
    this.socket.on("comment.added", (comment: CommentEntity, actor: EventActor) =>
      this.emit({ type: "commented", actorId: actor.id, comment })

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
