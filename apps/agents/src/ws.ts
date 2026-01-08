/*
Comms with the backend

Idea:
Each agent / task / session will have a sandboxed environment that will not be where the backend logic lives.
This sandbox environment needs communication with the backend to know when tasks change.
This module does that.

We'll start easy using the existing websocket endpoints for taskeroo and see what we can do.
*/

import { io, Socket } from "socket.io-client";
import { TaskEntity } from "../../backend/src/taskeroo/task.entity";

type TaskHandler = (task: TaskEntity) => void;


export class TaskerooListener {
  private socket: Socket;

  constructor(
    baseUrl: string,
    private onTask: TaskHandler,
  ) {
    this.socket = io(`${baseUrl}/taskeroo`, {
      transports: ["websocket"],
      withCredentials: true,
    });

    this.wire();
  }

  private wire() {
    this.socket.on("connect", () => {
      console.log("[taskeroo] connected:", this.socket.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[taskeroo] disconnected:", reason);
    });

    this.socket.on("connect_error", (err) => {
      console.error("[taskeroo] connect_error:", err.message);
    });

    // ---- events we care about ----

    this.socket.on("task.created", (task: TaskEntity) => {
      console.log("[task.created]");
      this.onTask(task);
    });

    this.socket.on("task.assigned", (task: TaskEntity) => {
      console.log("[task.assigned]");
      this.onTask(task);
    });

    this.socket.on("task.status_changed", (task: TaskEntity) => {
      console.log("[task.status_changed]");
      this.onTask(task);
    });

    // ---- events we ignore (for now) ----

    this.socket.on("task.updated", () => {
      console.log("[task.updated] ignored");
    });

    this.socket.on("task.deleted", (payload) => {
      console.log("[task.deleted] ignored", payload);
    });

    this.socket.on("task.commented", () => {
      console.log("[task.commented] ignored");
    });
  }

  close() {
    this.socket.disconnect();
  }
}
