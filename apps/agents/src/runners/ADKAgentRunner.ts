// ADKAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { LlmAgent, Runner, InMemorySessionService, MCPToolset } from "@google/adk";
import { ADKMessageFormatter } from "src/formatters/ADKMessageFormatter.js";
import { ACCESS_TOKEN, BASE_URL } from "src/helpers/config.js";
import { RUN_ID_HEADER } from "src/helpers/config.js";
import { AgentRunContext } from "./AgentRunner.js";

export class ADKAgentRunner extends BaseAgentRunner {
  readonly kind = 'adk';

  private formatter = new ADKMessageFormatter();
  
  private sessionService = new InMemorySessionService();
  
  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
  ): Promise<string> {
    
    let finalResult = '';

    // Init a session
    const session = await this.sessionService.createSession({
      appName: 'app-123',
      sessionId: 'session-123',
      userId: 'user-123',
    });

    const agent = new LlmAgent({
      name: 'agent',
      model: 'gemini-2.5-flash',
      description: '',
      instruction: '',
      tools: [
        new MCPToolset({
          type: 'StreamableHTTPConnectionParams',
          url: `${BASE_URL}/api/v1/tasks/tasks/mcp`,
          header: {
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            [RUN_ID_HEADER]: ctx.runId,
          },
        })
      ]
    });

    const runner = new Runner({
      appName: 'app-123',
      agent: agent,
      sessionService: this.sessionService,
    });

    const stream = runner.runAsync({
      userId: session.userId,
      sessionId: session.id,
      newMessage: {
        parts: [
          {
            text: ctx.prompt,
          }
        ],
        role: 'user',
      }
    });

    for await (const msg of stream) {
      // map → string
      const messages = this.formatter.format(msg);
      messages.forEach(async (message) => {
        await emit(message);
      });
    }

    return finalResult;
  }
}
