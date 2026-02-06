// ADKAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { LlmAgent, Runner, InMemorySessionService, MCPToolset } from "@google/adk";
import { ADKMessageFormatter } from "src/formatters/ADKMessageFormatter.js";
import { ACCESS_TOKEN, BASE_URL } from "src/helpers/config.js";
import { RUN_ID_HEADER } from "src/helpers/config.js";
import { AgentModelConfig, AgentRunContext } from "./AgentRunner.js";

export class ADKAgentRunner extends BaseAgentRunner {
  readonly kind = 'adk';

  private formatter = new ADKMessageFormatter();
  private modelId: string;

  private static sessionService = new InMemorySessionService();

  constructor(modelConfig: AgentModelConfig = {}) {
    super();
    this.modelId = modelConfig.modelId ?? 'gemini-2.5-flash';
  }
  
  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
  ): Promise<string> {
    
    let finalResult = '';

    const appName = 'taico';
    const userId = 'adk-agent';
    const sessionService = ADKAgentRunner.sessionService;
    let session = ctx.resume
      ? await sessionService.getSession({
        appName,
        userId,
        sessionId: ctx.resume,
      })
      : undefined;

    if (!session) {
      session = await sessionService.createSession({
        appName,
        userId,
        sessionId: ctx.resume,
      });
    }

    await setSession(session.id);

    const agent = new LlmAgent({
      name: 'agent',
      model: this.modelId,
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
      appName,
      agent: agent,
      sessionService,
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
