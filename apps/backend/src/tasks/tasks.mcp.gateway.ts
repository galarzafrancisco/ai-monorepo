import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { TasksService } from "./tasks.service";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { TaskStatus } from "./enums";
import { AuthContext, UserContext } from "src/auth/guards/context/auth-context.types";
import { TasksScopes } from "./tasks.scopes";

@Injectable()
export class TasksMcpGateway {

  constructor(private readonly TasksService: TasksService) { }

  private buildServer(user: UserContext, authContext: AuthContext): McpServer {
    const server = new McpServer({
      name: 'Tasks',
      version: '0.0.0',
    });

    const canWrite = authContext.scopes.find(scope => scope === TasksScopes.WRITE.id);

    server.registerTool(
      'list_tasks',
      {
        title: 'List tasks',
        description: 'Use to get a summary of tasks available', // Keep descriptions short to save tokens. Explain when to use it.
        inputSchema: {
          tag: z.string().optional(),
        },
      },
      async ({ tag }) => {
        const tasks = await this.TasksService.listTasks({
          tag,
          page: 0,
          limit: 20,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tasks.items.map(t => {
              return {
                name: t.name,
                assignee: t.assignee,
                status: t.status,
                id: t.id,
              }
            })),
          }],
        }
      }
    )

    server.registerTool(
      'get_task',
      {
        title: 'Get task details',
        description: 'Retrieve full details of a task by ID',
        inputSchema: {
          taskId: z.string(),
        },
      },
      async ({ taskId }) => {
        const task = await this.TasksService.getTaskById(taskId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(task),
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'create_task',
      {
        title: 'Create a new task',
        description: 'Create task with name and description',
        inputSchema: {
          name: z.string(),
          description: z.string(),
          assigneeActorId: z.string().optional(),
          sessionId: z.string().optional(),
          dependsOnIds: z.array(z.string()).optional(),
        },
      },
      async ({ name, description, assigneeActorId, sessionId, dependsOnIds }) => {
        const task = await this.TasksService.createTask({
          name,
          description,
          assigneeActorId,
          sessionId,
          createdByActorId: user.actorId,
          dependsOnIds,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(task),
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'assign_task',
      {
        title: 'Assign task',
        description: 'Assign task to someone, optionally with session',
        inputSchema: {
          taskId: z.string(),
          assigneeActorId: z.string(),
          sessionId: z.string().optional(),
        },
      },
      async ({ taskId, assigneeActorId, sessionId }) => {
        const task = await this.TasksService.assignTask(taskId, {
          assigneeActorId,
          sessionId,
        });
        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'add_comment',
      {
        title: 'Add comment to task',
        description: 'Add comment',
        inputSchema: {
          taskId: z.string(),
          content: z.string(),
        },
      },
      async ({ taskId, content }) => {
        await this.TasksService.addComment(taskId, {
          commenterActorId: user.actorId,
          content,
        });
        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'mark_task_in_progress',
      {
        title: 'Start working on task',
        description: 'Assign task to yourself, set status to IN_PROGRESS, add comment with branch info',
        inputSchema: {
          taskId: z.string(),
          sessionId: z.string(),
          branchName: z.string(),
        },
      },
      async ({ taskId, sessionId, branchName }) => {
        // Assign task
        await this.TasksService.assignTask(taskId, { assigneeActorId: user.actorId, sessionId });

        // Change status to IN_PROGRESS
        await this.TasksService.changeStatus(taskId, {
          status: TaskStatus.IN_PROGRESS,
        });

        // Add comment
        await this.TasksService.addComment(taskId, {
          commenterActorId: user.actorId,
          content: `Starting to work on this. I've created the branch ${branchName}`,
        });

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'mark_task_for_review',
      {
        title: 'Submit task for review',
        description: 'Set status to FOR_REVIEW and add PR link comment',
        inputSchema: {
          taskId: z.string(),
          prLink: z.string(),
        },
      },
      async ({ taskId, prLink }) => {
        // Change status to FOR_REVIEW
        await this.TasksService.changeStatus(taskId, {
          status: TaskStatus.FOR_REVIEW,
        });

        // Add comment with PR link
        await this.TasksService.addComment(taskId, {
          commenterActorId: user.actorId,
          content: `Opened PR for review: ${prLink}`,
        });

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'mark_task_done',
      {
        title: 'Mark task as done',
        description: 'Set status to DONE with completion comment',
        inputSchema: {
          taskId: z.string(),
          comment: z.string(),
        },
      },
      async ({ taskId, comment }) => {
        // Change status to DONE with comment
        await this.TasksService.changeStatus(taskId, {
          status: TaskStatus.DONE,
        });

        // Add a comment
        await this.TasksService.addComment(taskId, {
          commenterActorId: user.actorId,
          content: comment,
        });

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'mark_task_needs_work',
      {
        title: 'Flags the task as needing work',
        description: 'Set status to back to IN_PROGRESS with a comment',
        inputSchema: {
          taskId: z.string(),
          comment: z.string(),
        },
      },
      async ({ taskId, comment }) => {
        // Change status to IN_PROGRESS with comment
        await this.TasksService.changeStatus(taskId, {
          status: TaskStatus.IN_PROGRESS,
        });

        // Add a comment
        await this.TasksService.addComment(taskId, {
          commenterActorId: user.actorId,
          content: comment,
        });

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'change_task_status',
      {
        title: 'Change task status',
        description: 'Change task status with optional comment',
        inputSchema: {
          taskId: z.string(),
          status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'FOR_REVIEW', 'DONE']),
          comment: z.string().optional(),
        },
      },
      async ({ taskId, status, comment }) => {
        await this.TasksService.changeStatus(taskId, {
          status: status as TaskStatus,
          comment,
        });

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'add_tag_to_task',
      {
        title: 'Add tag to task',
        description: 'Add a tag to a task by tag name',
        inputSchema: {
          taskId: z.string(),
          tagName: z.string(),
          color: z.string().optional(),
        },
      },
      async ({ taskId, tagName, color }) => {
        await this.TasksService.addTagToTask(taskId, {
          name: tagName,
          color,
        });

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    canWrite && server.registerTool(
      'remove_tag_from_task',
      {
        title: 'Remove tag from task',
        description: 'Remove a tag from a task',
        inputSchema: {
          taskId: z.string(),
          tagId: z.string(),
        },
      },
      async ({ taskId, tagId }) => {
        await this.TasksService.removeTagFromTask(taskId, tagId);

        return {
          content: [{
            type: "text",
            text: "done",
          }],
        }
      }
    )

    server.registerTool(
      'get_all_tags',
      {
        title: 'Get all tags',
        description: 'List all available tags',
      },
      async ({}) => {
        const tags = await this.TasksService.getAllTags();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(tags),
          }],
        }
      }
    )

    return server;
  }

  async handleRequest(req: Request, res: Response, user: UserContext, authContext: AuthContext) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    const server = this.buildServer(user, authContext);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}