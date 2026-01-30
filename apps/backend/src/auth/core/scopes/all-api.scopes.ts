import { ALL_META_SCOPES } from 'src/meta/meta.scopes';
import { Scope } from '../types/scope.type';
import { ALL_TASKS_SCOPES } from 'src/tasks/tasks.scopes';
import { ALL_CONTEXT_SCOPES } from 'src/context/context.scopes';
import { ALL_AGENTS_SCOPES } from 'src/agents/agents.scopes';
import { ALL_MCP_SCOPES } from './mcp.scopes';
import { ALL_THREADS_SCOPES } from 'src/threads/threads.scopes';
import { ALL_MCP_REGISTRY_SCOPES } from 'src/mcp-registry/mcp-registry.scopes';

export const ALL_API_SCOPES: Scope[] = [
  // Metadata
  ...ALL_META_SCOPES,
  // Tasks
  ...ALL_TASKS_SCOPES,
  // Context
  ...ALL_CONTEXT_SCOPES,
  // Agents
  ...ALL_AGENTS_SCOPES,
  // Threads
  ...ALL_THREADS_SCOPES,
  // Read tools
  ...ALL_MCP_REGISTRY_SCOPES,
  // Permissions to use MCP
  ...ALL_MCP_SCOPES,
];
