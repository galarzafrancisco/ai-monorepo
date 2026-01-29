import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { Scope } from 'src/auth/core/types/scope.type';
import { getConfig } from 'src/config/env.config';
import { CreateServerInput } from 'src/mcp-registry/dto';
import { TasksScopes } from 'src/tasks/tasks.scopes';

const config = getConfig();

export const createTasks: CreateServerInput = {
  providedId: 'tasks',
  name: 'Tasks',
  description: 'This MCP server allows you to interact with tasks!',
  url: `${config.issuerUrl}/api/v1/tasks/tasks/mcp`,
};

export const createTasksScopes: Scope[] = [
  McpScopes.USE,
  TasksScopes.READ,
  TasksScopes.WRITE,
];
