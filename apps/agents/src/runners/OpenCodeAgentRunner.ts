// ClaudeAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { createOpencode, createOpencodeServer, OpencodeClient, TextPartInput } from "@opencode-ai/sdk";
import { OpencodeMessageFormatter } from "src/formatters/OpencodeMessageFormatter.js";
import { ACCESS_TOKEN, BASE_URL } from "src/helpers/config.js";
import { RUN_ID_HEADER } from "src/helpers/config.js";
import { AgentModelConfig, AgentRunContext, Model } from "./AgentRunner.js";

export class OpencodeAgentRunner extends BaseAgentRunner {
  readonly kind = 'opencode';

  private formatter = new OpencodeMessageFormatter();
  private client: OpencodeClient | null = null;
  private close: () => void = () => { };
  private model: Model;

  constructor(modelConfig: AgentModelConfig = {}) {
    super();
    const hasCustomModel = Boolean(modelConfig.providerId && modelConfig.modelId);
    this.model = {
      providerId: hasCustomModel ? modelConfig.providerId! : 'openai',
      modelId: hasCustomModel ? modelConfig.modelId! : 'gpt-5.2-codex',
    };
  }

  async init({ runId }: { runId: string }) {
    console.log('Starting Opencode client');

    let lastError: unknown;
    const PORT_START = 4000;
    const PORT_END = 4100;

    for (let port = PORT_START; port < PORT_END; port++) {
      try {
        console.log(`Trying port ${port}...`);

        const opencode = await createOpencode({
          port,
          timeout: 20 * 3600,
          config: {
            mcp: {
              tasks: {
                type: "remote",
                url: `${BASE_URL}/api/v1/tasks/tasks/mcp`,
                headers: {
                  Authorization: `Bearer ${ACCESS_TOKEN}`,
                  [RUN_ID_HEADER]: runId,
                },
                enabled: true,
              }
            }
          }
        });

        this.client = opencode.client;
        this.close = opencode.server.close;
        console.log(`Opencode started on port ${port}`);
        return;
      } catch (err) {
        console.warn(`Port ${port} failed, trying next...`);
        lastError = err;
      }
    }

    throw new Error(`Failed to start Opencode on ports ${PORT_START}–${PORT_END}: ${String(lastError)}`);
  }

  protected async runInternal(
    ctx: AgentRunContext,
    emit: (msg: string) => Promise<void>,
    setSession: (id: string) => Promise<void>,
    onError?: (error: { message: string; rawMessage?: any }) => void | Promise<void>,
  ): Promise<string> {
    // Start client
    await this.init({ runId: ctx.runId });
    if (!this.client) {
      throw new Error("Failed to create Opencode client");
    }

    // Create a session for this work
    const { data: session } = await this.client.session.create({
      body: {
        title: `Session ${new Date().toLocaleString()}`,
      },
      query: {
        directory: ctx.cwd,
      },

    });
    if (!session) {
      // Close the server
      if (this.close) {
        this.close();
      }
      throw new Error("Failed to create Opencode session");
    }
    console.log(`created session ${session.id} in ${session.directory}`);

    const model = this.model;

    const prompt: TextPartInput = {
      type: 'text',
      text: ctx.prompt,
    }
    let finalResult = '';
    const { data: response } = await this.client.session.prompt({
      path: {
        id: session.id,
      },
      query: {
        directory: ctx.cwd,
      },
      body: {
        model: {
          providerID: model.providerId,
          modelID: model.modelId,
        },
        parts: [prompt],
      }
    })


    if (!response) {
      // Close the server
      if (this.close) {
        this.close();
      }
      return "No response";
    }

    const messages = this.formatter.format(response.info, response.parts);
    messages.forEach(emit);


    console.log("---------- FINAL RESULT ----------");
    finalResult = this.formatter.format(response.info, [])[0];
    console.log(finalResult);

    emit(finalResult);

    // Close the server
    if (this.close) {
      this.close();
    }

    return finalResult;
  }
}
