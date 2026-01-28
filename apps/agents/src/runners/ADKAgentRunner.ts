// ADKAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { LlmAgent, Runner, InMemorySessionService, MCPToolset } from "@google/adk";
import { ADKMessageFormatter } from "src/formatters/ADKMessageFormatter.js";
import { ACCESS_TOKEN, BASE_URL } from "src/helpers/config.js";

export class ADKAgentRunner extends BaseAgentRunner {
  readonly kind = 'adk';

  private formatter = new ADKMessageFormatter();
  
  private sessionService = new InMemorySessionService();
  
  protected async runInternal(
    ctx,
    emit,
    setSession,
    onError?
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
            Authorization: `Bearer ${ACCESS_TOKEN}`
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
