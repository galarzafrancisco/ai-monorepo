// agentApiClient.ts
import { AgentResponseDto } from "../../backend/src/agents/dto/agent-response.dto.js";
import { CreateCommentDto } from "../../backend/src/tasks/dto/create-comment.dto.js";
import { AgentRunResponseDto } from "../../backend/src/agent-runs/dto/agent-run-response.dto.js";
import { CreateAgentRunDto } from "../../backend/src/agent-runs/dto/create-agent-run.dto.js";
import { ProjectResponseDto } from "@taico/shared/client";

export class Taico {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
  ) { }

  private agentUrl(agentSlug: string) {
    return `${this.baseUrl}/api/v1/agents/${encodeURIComponent(agentSlug)}`;
  }

  private taskUrl(taskId: string) {
    return `${this.baseUrl}/api/v1/tasks/tasks/${encodeURIComponent(taskId)}`;
  }

  async getAgent(agentSlug: string): Promise<AgentResponseDto | null> {
    const url = this.agentUrl(agentSlug);

    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${this.accessToken}` },
    });


    if (res.status !== 200) {
      try {
        const err = await res.json();
        if (err['code'] === "AGENT_NOT_FOUND") {
          return null;
        }
      } catch { }
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

  async addComment(taskId: string, comment: string): Promise<void> {
    const url = `${this.taskUrl(taskId)}/comments`;

    const payload: CreateCommentDto = {
      content: comment,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    // Most APIs return 201 for successful POSTs, but allow 200 as well
    if (res.status !== 200 && res.status !== 201) {
      console.error(`Failed to post comment to task ${taskId}:`);
    }
    return;
  }

  async getProjectBySlug(slug: string): Promise<ProjectResponseDto | null> {
    const url = `${this.baseUrl}/api/v1/meta/projects/by-slug/${encodeURIComponent(slug)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", authorization: `Bearer ${this.accessToken}` },
    });

    if (res.status === 404) {
      return null;
    }

    if (res.status !== 200) {
      throw new Error(
        [
          `[Traff] Failed to fetch project by slug.`,
          `GET ${url}`,
          `Expected 200, got ${res.status} ${res.statusText}`,
        ].join("\n")
      );
    }

    const project = await res.json() as ProjectResponseDto;
    return project;
  }

  async startRun(taskId: string): Promise<AgentRunResponseDto | null> {
    const url = `${this.baseUrl}/api/v1/agent-runs`;

    const payload: CreateAgentRunDto = {
      parentTaskId: taskId,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${this.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    // Most APIs return 201 for successful POSTs, but allow 200 as well
    if (res.status !== 200 && res.status !== 201) {
      console.error(`Failed to post comment to task ${taskId}:`);
    }

    
    const run = await res.json() as AgentRunResponseDto;
    return run;
  }
}
