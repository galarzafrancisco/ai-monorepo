import { getConfig } from 'src/config/env.config';
import { CreateServerInput } from 'src/mcp-registry/dto';

const config = getConfig();

export const createChromeDevTools: CreateServerInput = {
  providedId: 'chrome-devtools',
  name: 'Chrome DevTools',
  description: 'Controls and inspect a live Chrome browser and provides DevTools stuff like debugging',
  type: 'stdio',
  cmd: 'npx',
  args: ['-y','chrome-devtools-mcp@latest', '--no-usage-statistics'],
};
