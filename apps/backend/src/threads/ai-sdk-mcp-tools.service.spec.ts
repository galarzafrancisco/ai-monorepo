import { createMCPClient } from '@ai-sdk/mcp';
import { AiSdkMcpToolsService } from './ai-sdk-mcp-tools.service';

jest.mock('@ai-sdk/mcp', () => ({ createMCPClient: jest.fn() }));
jest.mock('src/config/env.config', () => ({ getConfig: () => ({ issuerUrl: 'http://localhost:2000' }) }));

describe('AiSdkMcpToolsService', () => {
  const createClient = jest.mocked(createMCPClient);
  const makeClient = (tools = {}) => ({
    tools: jest.fn().mockResolvedValue(tools), close: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => createClient.mockReset());

  it('namespaces tools while preserving their original execution bindings and scoped authentication', async () => {
    const tasksTool = { execute: jest.fn() };
    const contextTool = { execute: jest.fn() };
    const tasks = makeClient({ fetch: tasksTool });
    const context = makeClient({ get_block: contextTool });
    createClient.mockResolvedValueOnce(tasks as any).mockResolvedValueOnce(context as any);
    const result = await new AiSdkMcpToolsService().createTools('ephemeral-token');
    expect(result.tools).toEqual({ tasks__fetch: tasksTool, context__get_block: contextTool });
    expect(createClient.mock.calls.map(([config]) => config.transport)).toEqual([
      expect.objectContaining({ type: 'http', url: expect.stringContaining('/api/v1/tasks/tasks/mcp'), headers: { Authorization: 'Bearer ephemeral-token' } }),
      expect.objectContaining({ type: 'http', url: expect.stringContaining('/api/v1/context/blocks/mcp'), headers: { Authorization: 'Bearer ephemeral-token' } }),
    ]);
    await result.close();
    expect(tasks.close).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('closes a connected client when another connection fails', async () => {
    const tasks = makeClient();
    createClient.mockResolvedValueOnce(tasks as any).mockRejectedValueOnce(new Error('Connection failed'));
    await expect(new AiSdkMcpToolsService().createTools('token')).rejects.toThrow('Connection failed');
    expect(tasks.close).toHaveBeenCalledTimes(1);
  });

  it('closes all connected clients when tool discovery fails', async () => {
    const tasks = makeClient();
    const context = makeClient();
    context.tools.mockRejectedValue(new Error('Discovery failed'));
    createClient.mockResolvedValueOnce(tasks as any).mockResolvedValueOnce(context as any);
    await expect(new AiSdkMcpToolsService().createTools('token')).rejects.toThrow('Discovery failed');
    expect(tasks.close).toHaveBeenCalledTimes(1);
    expect(context.close).toHaveBeenCalledTimes(1);
  });
});
