import { McpScopes } from "src/auth/core/scopes/mcp.scopes";
import { Scope } from "src/auth/core/types/scope.type";
import { getConfig } from "src/config/env.config";
import { CreateServerInput } from "src/mcp-registry/dto";
import { TaskerooScopes } from "src/taskeroo/taskeroo.scopes";

const config = getConfig();

export const createTaskeroo: CreateServerInput = {
  providedId: 'taskeroo',
  name: "Taskeroo",
  description: "Taskeroo",
  url: `${config.issuerUrl}/api/v1/taskeroo/tasks/mcp`,
}

export const createTaskerooScopes: Scope[] = [
  McpScopes.USE,
  TaskerooScopes.READ,
  TaskerooScopes.WRITE,
];