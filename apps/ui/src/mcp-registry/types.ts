export interface McpServer {
  id: string;
  providedId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpScope {
  id: string;
  scopeId: string;
  serverId: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpConnection {
  id: string;
  serverId: string;
  clientId: string;
  authorizeUrl: string;
  tokenUrl: string;
  friendlyName: string;
  createdAt: string;
  updatedAt: string;
}

export interface McpScopeMapping {
  id: string;
  scopeId: string;
  serverId: string;
  connectionId: string;
  downstreamScope: string;
  createdAt: string;
  updatedAt: string;
}
