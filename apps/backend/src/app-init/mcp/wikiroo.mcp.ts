import { getConfig } from "src/config/env.config";
import { CreateScopeInput, CreateServerInput } from "src/mcp-registry/dto";

const config = getConfig();

export const createWikiroo: CreateServerInput = {
  providedId: 'wikiroo',
  name: "Wikiroo",
  description: "Wikiroo",
  url: `${config.issuerUrl}/api/v1/wikiroo/pages/mcp`,
}

export const createWikirooScopes: CreateScopeInput[] = [
  {
    scopeId: 'mcp:use',
    description: 'Allows users to interact with MCP endpoints.'
  },
  {
    scopeId: 'wikiroo:read',
    description: 'Allows users to read pages, tags, comments, etc from Wikiroo.'
  },
  {
    scopeId: 'wikiroo:write',
    description: 'Allows users to create/update/delete pages, tags, comments from Wikiroo.'
  }
];