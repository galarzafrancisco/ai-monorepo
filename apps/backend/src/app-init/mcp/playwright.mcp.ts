import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';
import { Scope } from 'src/auth/core/types/scope.type';
import { getConfig } from 'src/config/env.config';
import { CreateServerInput } from 'src/mcp-registry/dto';
import { TasksScopes } from 'src/tasks/tasks.scopes';

const config = getConfig();

export const createPlaywright: CreateServerInput = {
  providedId: 'playwright',
  name: 'Playwright',
  description: 'Browser for testing UI webapps',
  type: 'stdio',
  cmd: 'npx',
  args: ['-y','@playwright/mcp@latest', '--allowed-hosts', '"http://localhost:*"','--allowed-origins', '"http://localhost:*"'],
};