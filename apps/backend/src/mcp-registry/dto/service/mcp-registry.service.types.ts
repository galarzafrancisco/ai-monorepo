/**
 * Service-layer types for MCP Registry domain logic.
 * These are transport-agnostic and avoid framework-specific decorators.
 */

export type CreateServerInput = {
  providedId: string;
  name: string;
  description: string;
  url?: string;
};

export type UpdateServerInput = {
  name?: string;
  description?: string;
  url?: string;
};

export type CreateScopeInput = {
  scopeId: string;
  description: string;
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

export type ServerRecord = {
  id: string;
  providedId: string;
  name: string;
  description: string;
  url?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ScopeRecord = {
  id: string;
  scopeId: string;
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
