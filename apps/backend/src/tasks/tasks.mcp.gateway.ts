import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { TasksService } from './tasks.service';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { TaskStatus } from './enums';
import {
  AuthContext,
  UserContext,
} from 'src/auth/guards/context/auth-context.types';
import { TasksScopes } from './tasks.scopes';
import { ActorService } from 'src/identity-provider/actor.service';
import { MetaService } from 'src/meta/meta.service';

@Injectable()
export class TasksMcpGateway {
  constructor(
    private readonly tasksService: TasksService,
    private readonly metaService: MetaService,
    private readonly actorService: ActorService,
  ) {}

  private buildServer(
    user: UserContext,
    authContext: AuthContext,
    runId?: string,
  ): McpServer {
    const server = new McpServer({
      name: 'Tasks',
      version: '0.0.0',
    });

    const canWrite = authContext.scopes.find(
      (scope) => scope === TasksScopes.WRITE.id,
    );

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
        const tasks = await this.tasksService.listTasks({
          tag,
          page: 1,
          limit: 20,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                tasks.items.map((t) => {
                  return {
                    name: t.name,
                    assignee: t.assignee,
                    status: t.status,
                    id: t.id,
                  };
                }),
              ),
            },
          ],
        };
      },
    );

    server.registerTool(
      'list_tasks_filtered',
      {
        title: 'List tasks with filters',
        description:
          'List tasks by status and recency with a configurable limit.',
        inputSchema: {
          status: z.nativeEnum(TaskStatus).optional(),
          assignee: z.string().optional(),
          tag: z.string().optional(),
          updatedWithinHours: z.number().positive().optional(),
          limit: z.number().int().positive().max(500).optional(),
        },
      },
      async ({ status, assignee, tag, updatedWithinHours, limit }) => {
        const updatedAfter =
          updatedWithinHours !== undefined
            ? new Date(Date.now() - updatedWithinHours * 60 * 60 * 1000)
            : undefined;

        const tasks = await this.tasksService.listTasks({
          status,
          assignee,
          tag,
          updatedAfter,
          page: 1,
          limit: limit ?? 100,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                tasks.items.map((t) => {
                  return {
                    name: t.name,
                    assignee: t.assignee,
                    status: t.status,
                    id: t.id,
                  };
                }),
              ),
            },
          ],
        };
      },
    );

    server.registerTool(
      'fetch',
      {
        title: 'Get task details',
        description: 'Retrieve full details of a task by ID',
        inputSchema: {
          taskId: z.string(),
        },
      },
      async ({ taskId }) => {
        const task = await this.tasksService.getTaskById(taskId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(task),
            },
          ],
        };
      },
    );

    server.registerTool(
      'search',
      {
        title: 'Search tasks',
        description:
          'Fuzzy search for tasks by name and description. Returns matching tasks sorted by relevance.',
        inputSchema: {
          query: z.string(),
          limit: z.number().optional(),
          threshold: z.number().optional(),
        },
      },
      async ({ query, limit, threshold }) => {
        const results = await this.tasksService.searchTasks({
          query,
          limit,
          threshold,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results),
            },
          ],
        };
      },
    );

    server.registerTool(
      'search_actors',
      {
        title: 'Search actors',
        description:
          'Fuzzy search for actors by display name or slug. Returns matching actors sorted by relevance.',
        inputSchema: {
          query: z.string(),
        },
      },
      async ({ query }) => {
        const results = await this.actorService.searchActors({
          query,
          limit: 10,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results),
            },
          ],
        };
      },
    );

    canWrite &&
      server.registerTool(
        'create_task',
        {
          title: 'Create a new task',
          description: 'Create task with name and description',
          inputSchema: {
            name: z.string(),
            description: z.string(),
            assigneeActorId: z.string().optional(),
            dependsOnIds: z.array(z.string()).optional(),
          },
        },
        async ({
          name,
          description,
          assigneeActorId,
          dependsOnIds,
        }) => {
          let task;

          // If we have a run ID, create task in thread
          if (runId) {
            task = await this.tasksService.createTaskInThread({
              name,
              description,
              assigneeActorId,
              createdByActorId: user.actorId,
              dependsOnIds,
              runId,
            });
          } else {
            // Otherwise, create task normally
            task = await this.tasksService.createTask({
              name,
              description,
              assigneeActorId,
              createdByActorId: user.actorId,
              dependsOnIds,
            });
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(task),
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
        'assign_task',
        {
          title: 'Assign task',
          description: 'Assign task to someone',
          inputSchema: {
            taskId: z.string(),
            assigneeActorId: z.string(),
          },
        },
        async ({ taskId, assigneeActorId }) => {
          const task = await this.tasksService.assignTask(
            taskId,
            {
              assigneeActorId,
            },
            user.actorId,
          );
          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
        'delete_task',
        {
          title: 'Delete task',
          description: 'Delete a task by ID',
          inputSchema: {
            taskId: z.string(),
          },
        },
        async ({ taskId }) => {
          await this.tasksService.deleteTask(taskId, user.actorId);
          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
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
          await this.tasksService.addComment(taskId, {
            commenterActorId: user.actorId,
            content,
          });
          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
        'add_artefact',
        {
          title: 'Add artefact to task',
          description: 'Add an artefact (like a PR link) to a task',
          inputSchema: {
            taskId: z.string(),
            name: z.string(),
            link: z.string(),
          },
        },
        async ({ taskId, name, link }) => {
          await this.tasksService.addArtefact(
            taskId,
            {
              name,
              link,
            },
            user.actorId,
          );
          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
        'mark_task_in_progress',
        {
          title: 'Start working on task',
          description:
            'Assign task to yourself, set status to IN_PROGRESS, add comment with branch info',
          inputSchema: {
            taskId: z.string(),
            branchName: z.string(),
          },
        },
        async ({ taskId, branchName }) => {
          // Assign task
          // TODO: Should this be a feature of the Backend itself? You can't start a task if it's not assigned to you?
          // And if the task has no assignee and you start it, it gets assigned to you?
          await this.tasksService.assignTask(
            taskId,
            { assigneeActorId: user.actorId },
            user.actorId,
          );

          // Change status to IN_PROGRESS
          await this.tasksService.changeStatus(
            taskId,
            {
              status: TaskStatus.IN_PROGRESS,
            },
            user.actorId,
          );

          // Add comment
          await this.tasksService.addComment(taskId, {
            commenterActorId: user.actorId,
            content: `Starting to work on this. I've created the branch ${branchName}`,
          });

          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
        'mark_task_for_review',
        {
          title: 'Submit task for review',
          description: 'Set status to FOR_REVIEW and add PR link as artefact',
          inputSchema: {
            taskId: z.string(),
            prLink: z.string(),
          },
        },
        async ({ taskId, prLink }) => {
          // Change status to FOR_REVIEW
          await this.tasksService.changeStatus(
            taskId,
            {
              status: TaskStatus.FOR_REVIEW,
            },
            user.actorId,
          );

          // Add artefact with PR link
          await this.tasksService.addArtefact(
            taskId,
            {
              name: 'Pull Request',
              link: prLink,
            },
            user.actorId,
          );

          // Add comment
          await this.tasksService.addComment(taskId, {
            commenterActorId: user.actorId,
            content: `Opened PR for review: ${prLink}`,
          });

          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
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
          await this.tasksService.changeStatus(
            taskId,
            {
              status: TaskStatus.DONE,
            },
            user.actorId,
          );

          // Add a comment
          await this.tasksService.addComment(taskId, {
            commenterActorId: user.actorId,
            content: comment,
          });

          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
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
          await this.tasksService.changeStatus(
            taskId,
            {
              status: TaskStatus.IN_PROGRESS,
            },
            user.actorId,
          );

          // Add a comment
          await this.tasksService.addComment(taskId, {
            commenterActorId: user.actorId,
            content: comment,
          });

          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
        'change_task_status',
        {
          title: 'Change task status',
          description: 'Change task status with optional comment',
          inputSchema: {
            taskId: z.string(),
            status: z.enum([
              'NOT_STARTED',
              'IN_PROGRESS',
              'FOR_REVIEW',
              'DONE',
            ]),
            comment: z.string().optional(),
          },
        },
        async ({ taskId, status, comment }) => {
          await this.tasksService.changeStatus(
            taskId,
            {
              status: status as TaskStatus,
              comment,
            },
            user.actorId,
          );

          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
        'add_tag_to_task',
        {
          title: 'Add tag to task',
          description: 'Add a tag to a task by tag name',
          inputSchema: {
            taskId: z.string(),
            tagName: z.string(),
          },
        },
        async ({ taskId, tagName }) => {
          await this.tasksService.addTagToTask(
            taskId,
            {
              name: tagName,
            },
            user.actorId,
          );

          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    canWrite &&
      server.registerTool(
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
          await this.tasksService.removeTagFromTask(
            taskId,
            tagId,
            user.actorId,
          );

          return {
            content: [
              {
                type: 'text',
                text: 'done',
              },
            ],
          };
        },
      );

    server.registerTool(
      'get_all_tags',
      {
        title: 'Get all tags',
        description: 'List all available tags',
      },
      async ({}) => {
        const tags = await this.metaService.getAllTags();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tags),
            },
          ],
        };
      },
    );

    canWrite &&
      server.registerTool(
        'ask_for_input',
        {
          title: 'Ask for input from user',
          description:
            'Use this tool when you need input from a user. This is the ONLY way for headless agents to communicate with users. Provide the taskId, your question, and optionally the actorId of who to ask (defaults to task creator if not provided).',
          inputSchema: {
            taskId: z.string(),
            question: z.string(),
            actorId: z.string().optional(),
          },
        },
        async ({ taskId, question, actorId }) => {
          const inputRequest = await this.tasksService.createInputRequest({
            taskId,
            askedByActorId: user.actorId,
            assignedToActorId: actorId,
            question,
          });
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(inputRequest),
              },
            ],
          };
        },
      );

    return server;
  }

  async handleRequest(
    req: Request,
    res: Response,
    user: UserContext,
    authContext: AuthContext,
    runId?: string,
  ) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => {
      transport.close();
    });

    const server = this.buildServer(user, authContext, runId);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  }
}
