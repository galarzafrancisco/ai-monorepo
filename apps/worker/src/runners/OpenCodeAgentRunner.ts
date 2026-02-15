// ClaudeAgentRunner.ts
import { BaseAgentRunner } from "./BaseAgentRunner.js";
import { createOpencode, OpencodeClient, TextPartInput } from "@opencode-ai/sdk";
import { OpencodeAsyncMessageFormatter, opencodePartToText } from "../formatters/OpencodeMessageFormatter.js";
import { ACCESS_TOKEN, BASE_URL, RUN_ID_HEADER } from "../helpers/config.js";
import { AgentModelConfig, AgentRunContext, Model } from "./AgentRunner.js";

export class OpencodeAgentRunner extends BaseAgentRunner {
  readonly kind = 'opencode';

  // Mutex for process.chdir: serializes all instances so only one
  // changes the working directory at a time.
  private static chdirLock: Promise<void> = Promise.resolve();

  private formatter = new OpencodeAsyncMessageFormatter();
  private client: OpencodeClient | null = null;
  private abortController: AbortController = new AbortController();
  private close: () => void = () => {};
  private model: Model;

  constructor(modelConfig: AgentModelConfig = {}) {
    super();
    const hasCustomModel = Boolean(modelConfig.providerId && modelConfig.modelId);
    this.model = {
      providerId: hasCustomModel ? modelConfig.providerId! : 'openai',
      modelId: hasCustomModel ? modelConfig.modelId! : 'gpt-5.2-codex',
    };
  }

  private static readonly CHDIR_TIMEOUT_MS = 60_000; // 1 min — if we wait longer, something is stuck

  async initBullshit({ runId, cwd }: { runId: string, cwd: string }) {
    // Disgusting hack to start the server in the working directory
    // because Opencode has a bug where running a session in a different
    // folder breaks realtime events (???)
    //
    // We serialize via a promise chain so parallel runners don't stomp
    // on each other's cwd. A timeout prevents waiting forever if a
    // previous init hangs.

    let release!: () => void;
    const acquired = new Promise<void>(resolve => { release = resolve; });

    const prev = OpencodeAgentRunner.chdirLock;
    OpencodeAgentRunner.chdirLock = acquired;

    // Wait for the previous holder, but not forever.
    await Promise.race([
      prev,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(
          `initBullshit: timed out after ${OpencodeAgentRunner.CHDIR_TIMEOUT_MS}ms waiting for chdir lock — a previous init is likely stuck`
        )), OpencodeAgentRunner.CHDIR_TIMEOUT_MS),
      ),
    ]);

    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      await this.init({ runId });
    } finally {
      process.chdir(originalCwd);
      release();
    }
  }

  private shutdown() {
    // Belt and suspenders: abort signal + close().
    // close() alone is broken (https://github.com/anomalyco/opencode/issues/3841)
    // but we keep it for when they fix it.
    this.abortController.abort();
    this.close();
  }

  async init({ runId }: { runId: string }) {

    console.log('Starting Opencode client');

    let lastError: unknown;
    const PORT_START = 4000;
    const PORT_END = 4100;

    for (let port = PORT_START; port < PORT_END; port++) {
      try {
        console.log(`Trying port ${port}...`);

        this.abortController = new AbortController();
        const opencode = await createOpencode({
          port,
          timeout: 20 * 3600,
          signal: this.abortController.signal,
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
              },
              context: {
                type: "remote",
                url: `${BASE_URL}/api/v1/context/blocks/mcp`,
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
    await this.initBullshit({ runId: ctx.runId, cwd: ctx.cwd });
    // await this.init({ runId: ctx.runId });
    
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
      this.shutdown();
      throw new Error("Failed to create Opencode session");
    }
    console.log(`created session ${session.id} in ${session.directory}`);
    // Session is created in the right dir ✅

    const events = await this.client.event.subscribe(); // SSE stream

    const prompt: TextPartInput = {
      type: 'text',
      text: ctx.prompt,
    }
    let finalResult = '';
    this.client.session.promptAsync({
      path: {
        id: session.id,
      },
      // NOTE: adding a directory breaks realtime events 🤷🏻‍♂️: https://github.com/anomalyco/opencode/issues/11522
      // NOTE: Good news is we don't need it because the session carries the dir.
      // NOTE: Acutally we need to. I've implemented a horrible hack to CD before starting the server.
      // query: {
      //   directory: ctx.cwd,
      // },
      body: {
        model: {
          providerID: this.model.providerId,
          modelID: this.model.modelId,
        },
        parts: [prompt],
      }
    })

    try {
      for await (const event of events.stream) {
        // Detect end of session
        if (event.type == 'session.idle') {
          console.log('session.idle');
          break;
        }

        const message = this.formatter.format(event);
        if (message) {
          emit(message);
        }
      }
    } catch (error) {
      console.error(error);
    }

    this.shutdown();

    return finalResult;
  }
}
