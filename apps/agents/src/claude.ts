// agentRunner.ts
import { query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type AgentRunArgs = {
  prompt: string;
  cwd: string;
  resume?: string;
  persistSession?: boolean;

  // Called as soon as we learn the session id
  onSession?: (sessionId: string) => void | Promise<void>;

  // Called for every message (optional)
  onEvent?: (msg: SDKMessage) => void | Promise<void>;
};

export type AgentRunResult = {
  sessionId: string | null;
  events: any[];
};

export async function runAgentStream(args: AgentRunArgs): Promise<AgentRunResult> {
  const stream = query({
    prompt: args.prompt,
    options: {
      cwd: args.cwd,
      persistSession: args.persistSession ?? true,
      resume: args.resume,
      settingSources: ['user', 'project', 'local'],
    },
  });

  let sessionId: string | null = null;
  const events: any[] = [];

  for await (const msg of stream) {
    events.push(msg);

    // Emit every event (live)
    if (args.onEvent) await args.onEvent(msg);

    // Capture + persist session ASAP
    if (
      sessionId == null &&
      msg?.type === "system" &&
      msg?.subtype === "init" &&
      typeof msg?.session_id === "string"
    ) {
      sessionId = msg.session_id;
      if (args.onSession) await args.onSession(sessionId);
    }
  }

  return { sessionId, events };
}
