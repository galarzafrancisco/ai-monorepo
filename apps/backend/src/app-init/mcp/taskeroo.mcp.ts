import { getConfig } from "src/config/env.config";
import { CreateScopeInput, CreateServerInput } from "src/mcp-registry/dto";

const config = getConfig();

export const createTaskeroo: CreateServerInput = {
  providedId: 'taskeroo',
  name: "Taskeroo",
  description: "Taskeroo",
  url: `${config.issuerUrl}/api/v1/taskeroo/tasks/mcp`,
}

export const createTaskerooScopes: CreateScopeInput[] = [
  {
    scopeId: 'mcp:use',
    description: 'Allows users to interact with MCP endpoints.'
  },
  {
    scopeId: 'taskeroo:read',
    description: 'Allows users to read tasks, tags, comments, etc from Taskeroo.'
  },
  {
    scopeId: 'taskeroo:write',
    description: 'Allows users to create/update/delete tasks, tags, comments from Taskeroo.'
  }
];