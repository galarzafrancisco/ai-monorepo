// agentApiClient.ts

import { AgentResponseDto } from "../../backend/src/agents/dto/agent-response.dto";

export class AgentApiClient {
  constructor(private readonly baseUrl: string) {}

  private agentUrl(agentId: string) {
    return `${this.baseUrl}/api/v1/agents/${encodeURIComponent(agentId)}`;
  }

  async getAgent(agentId: string): Promise<AgentResponseDto | null> {
    const url = this.agentUrl(agentId);

    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    
    if (res.status !== 200) {
      try {
        const err = await res.json();
        if (err['code'] === "AGENT_NOT_FOUND") {
          return null;
        }
      } catch {}
      throw new Error(
        [
          `[AgentApiClient] Failed to fetch agent.`,
          `GET ${url}`,
          `Expected 200, got ${res.status} ${res.statusText}`,
        ].join("\n")
      );
    }
    
    const agent = await res.json() as AgentResponseDto;

    return agent;
  }

  async getAgentPrompt(agentId: string): Promise<string> {
    const agent = await this.getAgent(agentId);
    const prompt = agent?.systemPrompt;

    if (typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error(
        [
          `[AgentApiClient] Agent has no systemPrompt.`,
          `GET ${this.agentUrl(agentId)}`,
          `Body: ${JSON.stringify(agent)}`,
        ].join("\n")
      );
    }

    return prompt;
  }

  async getAgentStatusTriggers(agentId: string): Promise<string[]> {
    const agent = await this.getAgent(agentId);
    const triggers = agent?.statusTriggers;

    if (!Array.isArray(triggers) || triggers.some((t) => typeof t !== "string")) {
      throw new Error(
        [
          `[AgentApiClient] Agent has invalid statusTriggers (expected string[]).`,
          `GET ${this.agentUrl(agentId)}`,
          `Body: ${JSON.stringify(agent)}`,
        ].join("\n")
      );
    }

    return triggers;
  }
}
