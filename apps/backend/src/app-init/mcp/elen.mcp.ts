import { CreateServerInput } from 'src/mcp-registry/dto';

export const createElen: CreateServerInput = {
  providedId: 'elen',
  name: 'Elen',
  description: 'Learning nodes and knowledge management',
  type: 'stdio',
  cmd: 'npx',
  args: ['-y', '@learningnodes/elen-mcp@0.1.6'],
};
