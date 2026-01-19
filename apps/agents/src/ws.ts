/*
Comms with the backend

Idea:
Each agent / task / session will have a sandboxed environment that will not be where the backend logic lives.
This sandbox environment needs communication with the backend to know when tasks change.
This module does that.

We'll start easy using the existing websocket endpoints for tasks and see what we can do.
*/

import { io, Socket } from "socket.io-client";
import { TaskEntity } from "../../backend/src/tasks/task.entity";
import { ACCESS_TOKEN } from "./config";

type TaskHandler = (task: TaskEntity) => void;

export class TasksListener {
  private socket: Socket;

  constructor(
    baseUrl: string,
    private onTask: TaskHandler,
  ) {
    console.log(`[TasksListener] connecting to ${baseUrl}/tasks`);
    this.socket = io(`${baseUrl}/tasks`, {
      transports: ["websocket"],
      // withCredentials: true, // <- this is for front end cookies
      auth: {
        token: ACCESS_TOKEN,
      }
    });

    this.wire();
  }

  private wire() {
    this.socket.on("connect", () => {
      this.socket.emit('tasks.subscribe', {}, (ack: any) => {
        console.log("[tasks] subscribed to room:", ack);
      });
      console.log("[tasks] connected:", this.socket.id);
    });

    this.socket.on("disconnect", (reason) => {
      console.log("[tasks] disconnected:", reason);
    });

    this.socket.on("connect_error", (err) => {
      console.error("[tasks] connect_error:", err.message);
      console.error(err);
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
