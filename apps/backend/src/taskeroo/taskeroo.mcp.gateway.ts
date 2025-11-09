import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { TaskerooService } from "./taskeroo.service";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { TaskStatus } from "./enums";

@Injectable()
export class TaskerooMcpGateway {

  constructor(private readonly taskerooService: TaskerooService) { }

  private buildServer(): McpServer {
    const server = new McpServer({
      name: 'taskeroo',
      version: '0.0.0',
    });

    server.registerTool(
      'list_tasks',
      {
        title: 'List tasks',
        description: 'Use to get a summary of tasks available', // Keep descriptions short to save tokens. Explain when to use it.
        // inputSchema: {}, // If we don't need schemas, avoid them to save tokens
        // outputSchema: {}, // If we don't need schemas, avoid them to save tokens
      },
      async ({ }) => {
        const tasks = await this.taskerooService.listTasks({
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
      'add_numbers',
      {
        title: 'Adds numbers',
        description: '', // Title is enough to explain what this does, so no description is required. Save tokens! The models are smart enough.
        inputSchema: {
          a: z.number(), // Model will figure out what this input is, so no need to add description. But if the input were more complex, then yeah.
          b: z.number(), // Model will figure out what this input is, so no need to add description. But if the input were more complex, then yeah.
        },
        outputSchema: {
          result: z.number(),  // This is just an example showing how you'd provide structured output. Don't really need it for something simple like this.
        },
      },
      async ({ a, b }) => {
        const result = a + b;
        return {
          content: [
            {
              type: 'text',
              text: `${a} + ${b} = ${result}`
            }
          ],
          structuredContent: {
            result
          }
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
        const task = await this.taskerooService.getTaskById(taskId);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(task),
          }],
        }
      }
    )

    server.registerTool(
      'create_task',
      {
        title: 'Create a new task',
        description: 'Create task with name and description',
        inputSchema: {
          name: z.string(),
          description: z.string(),
          assignee: z.string().optional(),
          sessionId: z.string().optional(),
        },
      },
      async ({ name, description, assignee, sessionId }) => {
        const task = await this.taskerooService.createTask({
          name,
          description,
          assignee,
          sessionId,
        });
        return {
          content: [{
            type: "text",
            text: JSON.stringify(task),
          }],
        }
      }
    )

    server.registerTool(
      'assign_task',
      {
        title: 'Assign task',
        description: 'Assign task to someone, optionally with session',
        inputSchema: {
          taskId: z.string(),
          assignee: z.string(),
          sessionId: z.string().optional(),
        },
      },
      async ({ taskId, assignee, sessionId }) => {
        const task = await this.taskerooService.assignTask(taskId, {
          assignee,
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

    server.registerTool(
      'add_comment',
      {
        title: 'Add comment to task',
        description: 'Add comment with commenter name',
        inputSchema: {
          taskId: z.string(),
          commenterName: z.string(),
          content: z.string(),
        },
      },
      async ({ taskId, commenterName, content }) => {
        await this.taskerooService.addComment(taskId, {
          commenterName,
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

    server.registerTool(
      'mark_task_in_progress',
      {
        title: 'Start working on task',
        description: 'Assign task to yourself, set status to IN_PROGRESS, add comment with branch info',
        inputSchema: {
          taskId: z.string(),
          assignee: z.string(),
          sessionId: z.string(),
          branchName: z.string(),
        },
      },
      async ({ taskId, assignee, sessionId, branchName }) => {
        // Assign task
        await this.taskerooService.assignTask(taskId, { assignee, sessionId });

        // Change status to IN_PROGRESS
        await this.taskerooService.changeStatus(taskId, {
          status: TaskStatus.IN_PROGRESS,
        });

        // Add comment
        await this.taskerooService.addComment(taskId, {
          commenterName: assignee,
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

    server.registerTool(
      'mark_task_for_review',
      {
        title: 'Submit task for review',
        description: 'Set status to FOR_REVIEW and add PR link comment',
        inputSchema: {
          taskId: z.string(),
          assignee: z.string(),
          prLink: z.string(),
        },
      },
      async ({ taskId, assignee, prLink }) => {
        // Change status to FOR_REVIEW
        await this.taskerooService.changeStatus(taskId, {
          status: TaskStatus.FOR_REVIEW,
        });

        // Add comment with PR link
        await this.taskerooService.addComment(taskId, {
          commenterName: assignee,
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

    server.registerTool(
      'mark_task_done',
      {
        title: 'Mark task as done',
        description: 'Set status to DONE with completion comment',
        inputSchema: {
          taskId: z.string(),
          assignee: z.string(),
          comment: z.string(),
        },
      },
      async ({ taskId, assignee, comment }) => {
        // Change status to DONE with comment
        await this.taskerooService.changeStatus(taskId, {
          status: TaskStatus.DONE,
        });

        // Add a comment
        await this.taskerooService.addComment(taskId, {
          commenterName: assignee,
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

    server.registerTool(
      'mark_task_needs_work',
      {
        title: 'Flags the task as needing work',
        description: 'Set status to back to IN_PROGRESS with a comment',
        inputSchema: {
          taskId: z.string(),
          assignee: z.string(),
          comment: z.string(),
        },
      },
      async ({ taskId, assignee, comment }) => {
        // Change status to IN_PROGRESS with comment
        await this.taskerooService.changeStatus(taskId, {
          status: TaskStatus.IN_PROGRESS,
        });

        // Add a comment
        await this.taskerooService.addComment(taskId, {
          commenterName: assignee,
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

    server.registerTool(
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
        await this.taskerooService.changeStatus(taskId, {
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
    return server;
  }

  async handleRequest(req: Request, res: Response) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    const server = this.buildServer()
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}