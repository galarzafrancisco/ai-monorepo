import { ContextScopes } from './context.scopes';
import { ContextMcpGateway } from './context.mcp.gateway';
import { McpScopes } from 'src/auth/core/scopes/mcp.scopes';

jest.mock('./context.service', () => ({
  ContextService: jest.fn(),
}));

jest.mock('src/meta/meta.service', () => ({
  MetaService: jest.fn(),
}));

jest.mock('src/identity-provider/actor.service', () => ({
  ActorService: jest.fn(),
}));

jest.mock('src/threads/threads.service', () => ({
  ThreadsService: jest.fn(),
}));

jest.mock('src/config/env.config', () => ({
  getConfig: () => ({ appVersion: 'test', issuerUrl: 'http://taico.test' }),
}));

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tools: {},
    registerTool(this: any, name: string, config: unknown, handler: unknown) {
      this.tools[name] = { config, handler };
    },
    connect: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
    handleRequest: jest.fn(),
  })),
}));

const READ_TOOLS = [
  'list_blocks',
  'list_blocks_filtered',
  'search_blocks',
  'get_thread_state_memory',
  'get_block',
  'get_all_tags',
  'get_child_blocks',
  'get_block_tree',
];

const WRITE_TOOLS = [
  'attach_block_to_thread',
  'detach_block_from_thread',
  'create_block',
  'update_block',
  'append_block',
  'delete_block',
  'add_tag_to_block',
  'remove_tag_from_block',
];

describe('ContextMcpGateway scope enforcement', () => {
  const user = { actorId: 'actor-1' } as any;

  function toolsFor(scopes: string[]): string[] {
    const gateway = new ContextMcpGateway(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const server = (gateway as any).buildServer(user, { scopes } as any);
    return Object.keys(server.tools).sort();
  }

  it('exposes no context tools to a token holding only mcp:use', () => {
    expect(toolsFor([McpScopes.USE.id])).toEqual([]);
  });

  it('exposes only read tools to a token with context:read', () => {
    expect(toolsFor([McpScopes.USE.id, ContextScopes.READ.id])).toEqual(
      [...READ_TOOLS].sort(),
    );
  });

  it('exposes only write tools to a token with context:write', () => {
    expect(toolsFor([McpScopes.USE.id, ContextScopes.WRITE.id])).toEqual(
      [...WRITE_TOOLS].sort(),
    );
  });

  it('exposes every tool to a token with both context scopes', () => {
    expect(
      toolsFor([
        McpScopes.USE.id,
        ContextScopes.READ.id,
        ContextScopes.WRITE.id,
      ]),
    ).toEqual([...READ_TOOLS, ...WRITE_TOOLS].sort());
  });

  it('still forwards writes to the service when context:write is held', async () => {
    const contextService = {
      createBlock: jest.fn().mockResolvedValue({ id: 'block-1' }),
    };
    const gateway = new ContextMcpGateway(
      contextService as any,
      {} as any,
      {} as any,
      {} as any,
    );
    const server = (gateway as any).buildServer(user, {
      scopes: [McpScopes.USE.id, ContextScopes.WRITE.id],
    } as any);

    await server.tools.create_block.handler({
      title: 'T',
      content: 'C',
    });

    expect(contextService.createBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'T',
        content: 'C',
        createdByActorId: 'actor-1',
      }),
    );
  });
});
