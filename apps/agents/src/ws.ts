/*
Comms with the backend

Idea:
Each agent / task / session will have a sandboxed environment that will not be where the backend logic lives.
This sandbox environment needs communication with the backend to know when tasks change.
This module does that.

We'll start easy using the existing websocket endpoints for tasks and see what we can do.
*/

import { io, Socket } from "socket.io-client";
import { TaskEntity } from "../../backend/src/tasks/task.entity.js";
import { ACCESS_TOKEN } from "./helpers/config.js";
import {
  TaskWireEvents,
  TaskCreatedWireEvent,
  TaskAssignedWireEvent,
  TaskStatusChangedWireEvent,
  TaskUpdatedWireEvent,
  TaskDeletedWireEvent,
  TaskCommentedWireEvent,
} from "shared/types/task-events";

type TaskHandler = (task: TaskEntity, loopBack: (message: string) => void) => void;

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

    this.socket.on(TaskWireEvents.TASK_CREATED, (event: TaskCreatedWireEvent) => {
      console.log("[task.created]");
      this.onTask(event.payload as TaskEntity, this.postActivity);
    });

    this.socket.on(TaskWireEvents.TASK_ASSIGNED, (event: TaskAssignedWireEvent) => {
      console.log("[task.assigned]");
      this.onTask(event.payload as TaskEntity, this.postActivity);
    });

    this.socket.on(TaskWireEvents.TASK_STATUS_CHANGED, (event: TaskStatusChangedWireEvent) => {
      console.log("[task.status_changed]");
      this.onTask(event.payload as TaskEntity, this.postActivity);
    });

    // ---- events we ignore (for now) ----

    this.socket.on(TaskWireEvents.TASK_UPDATED, (event: TaskUpdatedWireEvent) => {
      console.log("[task.updated] ignored", event.payload);
    });

    this.socket.on(TaskWireEvents.TASK_DELETED, (event: TaskDeletedWireEvent) => {
      console.log("[task.deleted] ignored", event.payload);
    });

    this.socket.on(TaskWireEvents.TASK_COMMENTED, (event: TaskCommentedWireEvent) => {
      console.log("[task.commented] ignored", event.payload);
    });
  }

  postActivity(taskId: string, kind?: string, message?: string) {
    this.socket.emit(
      'task.activity.post',
      { taskId, kind, message },
      (ack: any) => console.log('[task.activity.post] ack:', ack),
    );
  }

  close() {
    this.socket.disconnect();
  }
}
