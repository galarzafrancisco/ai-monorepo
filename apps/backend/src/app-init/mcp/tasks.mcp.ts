import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { Scope } from 'src/auth/core/types/scope.type';
import { baselineServerUrl } from 'src/mcp-registry/baseline-servers';
import { CreateServerInput } from 'src/mcp-registry/dto';
import { TasksScopes } from 'src/tasks/tasks.scopes';

export function createTasks(): CreateServerInput {
  return {
    providedId: 'tasks',
    name: 'Tasks',
    description: 'This MCP server allows you to interact with tasks!',
    type: 'http',
    url: baselineServerUrl('tasks'),
  };
}

export const createTasksScopes: Scope[] = [
  McpScopes.USE,
  TasksScopes.READ,
  TasksScopes.WRITE,
];
