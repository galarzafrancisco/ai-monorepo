// agentApiClient.ts

import { AgentResponseDto } from "../../backend/src/agents/dto/agent-response.dto";
import { ACCESS_TOKEN } from "./config";

export class AgentApiClient {
  constructor(private readonly baseUrl: string) {}

  private agentUrl(agentSlug: string) {
    return `${this.baseUrl}/api/v1/agents/${encodeURIComponent(agentSlug)}`;
  }

  async getAgent(agentSlug: string): Promise<AgentResponseDto | null> {
    const url = this.agentUrl(agentSlug);

    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${ACCESS_TOKEN}` },
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

  async getAgentPrompt(agentSlug: string): Promise<string> {
    const agent = await this.getAgent(agentSlug);
    const prompt = agent?.systemPrompt;

    if (typeof prompt !== "string" || prompt.trim() === "") {
      throw new Error(
        [
          `[AgentApiClient] Agent has no systemPrompt.`,
          `GET ${this.agentUrl(agentSlug)}`,
          `Body: ${JSON.stringify(agent)}`,
        ].join("\n")
      );
    }

    return prompt;
  }

  async getAgentStatusTriggers(agentSlug: string): Promise<string[]> {
    const agent = await this.getAgent(agentSlug);
    const triggers = agent?.statusTriggers;

    if (!Array.isArray(triggers) || triggers.some((t) => typeof t !== "string")) {
      throw new Error(
        [
          `[AgentApiClient] Agent has invalid statusTriggers (expected string[]).`,
          `GET ${this.agentUrl(agentSlug)}`,
          `Body: ${JSON.stringify(agent)}`,
        ].join("\n")
      );
    }

    return triggers;
  }
}
