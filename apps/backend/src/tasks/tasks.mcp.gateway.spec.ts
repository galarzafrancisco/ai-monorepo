import { TasksScopes } from './tasks.scopes';
import { TasksMcpGateway } from './tasks.mcp.gateway';

jest.mock('./tasks.service', () => ({
  TasksService: jest.fn(),
}));

jest.mock('src/meta/meta.service', () => ({
  MetaService: jest.fn(),
}));

jest.mock('src/identity-provider/actor.service', () => ({
  ActorService: jest.fn(),
}));

jest.mock('src/threads/threads.service', () => ({
  ThreadsService: jest.fn(),
}));

jest.mock('src/config/env.config', () => ({
  getConfig: () => ({ appVersion: 'test' }),
}));

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tools: {},
    registerTool(this: any, name: string, config: unknown, handler: unknown) {
      this.tools[name] = { config, handler };
    },
    connect: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    handleRequest: jest.fn(),
  })),
}));

describe('TasksMcpGateway', () => {
  const user = { actorId: 'actor-1' } as any;
  const authContext = { scopes: [TasksScopes.WRITE.id] } as any;

  it('exposes and forwards tagNames when creating a task', async () => {
    const tasksService = {
      createTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
      createTaskInThread: jest.fn(),
    };
    const gateway = new TasksMcpGateway(
      tasksService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const server = (gateway as any).buildServer(user, authContext);
    const createTaskTool = server.tools.create_task;

    expect(createTaskTool.config.inputSchema.tagNames).toBeDefined();

    await createTaskTool.handler({
      name: 'Task with tags',
      description: 'Created through MCP',
      assigneeActorId: 'actor-2',
      dependsOnIds: ['dependency-1'],
      tagNames: ['code', 'project:taico'],
    });

    expect(tasksService.createTask).toHaveBeenCalledWith({
      name: 'Task with tags',
      description: 'Created through MCP',
      assigneeActorId: 'actor-2',
      createdByActorId: 'actor-1',
      dependsOnIds: ['dependency-1'],
      tagNames: ['code', 'project:taico'],
    });
  });

  it('forwards tagNames when creating a task in a thread context', async () => {
    const tasksService = {
      createTask: jest.fn(),
      createTaskInThread: jest.fn().mockResolvedValue({ id: 'task-1' }),
    };
    const gateway = new TasksMcpGateway(
      tasksService as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const server = (gateway as any).buildServer(
      user,
      authContext,
      'execution-1',
    );

    await server.tools.create_task.handler({
      name: 'Task with tags',
      description: 'Created through MCP',
      tagNames: ['code'],
    });

    expect(tasksService.createTaskInThread).toHaveBeenCalledWith({
      name: 'Task with tags',
      description: 'Created through MCP',
      assigneeActorId: undefined,
      createdByActorId: 'actor-1',
      dependsOnIds: undefined,
      tagNames: ['code'],
      executionId: 'execution-1',
      runId: undefined,
    });
  });

  describe('mark_task_in_progress', () => {
    const buildTool = () => {
      const tasksService = {
        assignTask: jest.fn().mockResolvedValue(undefined),
        changeStatus: jest.fn().mockResolvedValue(undefined),
        addComment: jest.fn().mockResolvedValue(undefined),
      };
      const gateway = new TasksMcpGateway(
        tasksService as any,
        {} as any,
        {} as any,
        {} as any,
      );
      const server = (gateway as any).buildServer(user, authContext);
      return { tasksService, tool: server.tools.mark_task_in_progress };
    };

    it('does not require a branch name', () => {
      const { tool } = buildTool();
      expect(tool.config.inputSchema.branchName.isOptional()).toBe(true);
    });

    it('claims the task without a branch (non-code work)', async () => {
      const { tasksService, tool } = buildTool();

      await tool.handler({ taskId: 'task-1' });

      expect(tasksService.assignTask).toHaveBeenCalledWith(
        'task-1',
        { assigneeActorId: 'actor-1' },
        'actor-1',
      );
      expect(tasksService.changeStatus).toHaveBeenCalledWith(
        'task-1',
        { status: 'IN_PROGRESS' },
        'actor-1',
      );
      expect(tasksService.addComment).toHaveBeenCalledWith('task-1', {
        commenterActorId: 'actor-1',
        content: 'Starting to work on this.',
      });
    });

    it('mentions the branch when one is given', async () => {
      const { tasksService, tool } = buildTool();

      await tool.handler({ taskId: 'task-1', branchName: 'feature/x' });

      expect(tasksService.addComment).toHaveBeenCalledWith('task-1', {
        commenterActorId: 'actor-1',
        content: 'Starting to work on this on branch `feature/x`.',
      });
    });
  });
});
