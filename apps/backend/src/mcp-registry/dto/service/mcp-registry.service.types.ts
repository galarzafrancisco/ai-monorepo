/**
 * Service-layer types for Tools domain logic.
 * These are transport-agnostic and avoid framework-specific decorators.
 */

import { McpServerType } from '../../mcp-server.types';

type ServerBase = {
  providedId: string;
  name: string;
  description: string;
};

type HttpServerConfig = {
  type: 'http';
  url: string;
  cmd?: undefined;
  args?: undefined;
};

type StdioServerConfig = {
  type: 'stdio';
  cmd: string;
  args?: string[];
  url?: undefined;
};

export type CreateServerInput = ServerBase & {
  type: McpServerType;
  url?: string;
  cmd?: string;
  args?: string[];
};

export type UpdateServerInput = {
  type?: McpServerType;
  name?: string;
  description?: string;
  url?: string;
  cmd?: string;
  args?: string[];
};

export type CreateConnectionInput = {
  friendlyName: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
};

export type UpdateConnectionInput = Partial<CreateConnectionInput>;

export type CreateMappingInput = {
  scopeId: string;
  connectionId: string;
  downstreamScope: string;
};

type ServerRecordBase = {
  id: string;
  providedId: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export type HttpServerRecord = ServerRecordBase & HttpServerConfig;
export type StdioServerRecord = ServerRecordBase & StdioServerConfig;
export type ServerRecord = HttpServerRecord | StdioServerRecord;

export type ScopeRecord = {
  id: string;
  serverId: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ConnectionRecord = {
  id: string;
  serverId: string;
  friendlyName: string;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  createdAt: Date;
  updatedAt: Date;
};

export type MappingRecord = {
  id: string;
  scopeId: string;
  serverId: string;
  connectionId: string;
  downstreamScope: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ServerWithRelationsRecord = ServerRecord & {
  scopes: ScopeRecord[];
  connections: ConnectionRecord[];
};

export type ScopeWithMappingsRecord = ScopeRecord & {
  mappings: MappingRecord[];
};

export type ConnectionWithMappingsRecord = ConnectionRecord & {
  mappings: MappingRecord[];
};

export type ListServersResult = {
  items: ServerRecord[];
  total: number;
  page: number;
  limit: number;
};

export type SearchServersInput = {
  query: string;
  limit?: number;
  threshold?: number;
};

export type ServerSearchResult = {
  id: string;
  name: string;
  score: number;
};
