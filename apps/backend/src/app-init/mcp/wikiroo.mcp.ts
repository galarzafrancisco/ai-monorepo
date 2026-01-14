import { McpScopes } from "src/auth/core/scopes/mcp.scopes";
import { Scope } from "src/auth/core/types/scope.type";
import { getConfig } from "src/config/env.config";
import { CreateServerInput } from "src/mcp-registry/dto";
import { WikirooScopes } from "src/wikiroo/wikiroo.scopes";

const config = getConfig();

export const createWikiroo: CreateServerInput = {
  providedId: 'wikiroo',
  name: "Wikiroo",
  description: "Wikiroo",
  url: `${config.issuerUrl}/api/v1/wikiroo/pages/mcp`,
}

export const createWikirooScopes: Scope[] = [
  McpScopes.USE,
  WikirooScopes.READ,
  WikirooScopes.WRITE,
];