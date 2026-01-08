// agentApi.ts
const BASE_URL = "https://ai.american-broomstick.com";

export async function getAgentPrompt(agentId: string): Promise<string> {
  const url = `${BASE_URL}/api/v1/agents/${encodeURIComponent(agentId)}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  const bodyText = await res.text();

  if (res.status !== 200) {
    throw new Error(
      [
        `[agentApi] Failed to fetch agent.`,
        `GET ${url}`,
        `Expected 200, got ${res.status} ${res.statusText}`,
        `Body: ${bodyText || "<empty>"}`,
      ].join("\n")
    );
  }

  let json: any;
  try {
    json = JSON.parse(bodyText);
  } catch {
    throw new Error(
      [
        `[agentApi] Invalid JSON from agents API.`,
        `GET ${url}`,
        `Body: ${bodyText || "<empty>"}`,
      ].join("\n")
    );
  }

  const prompt = json?.systemPrompt;

  if (typeof prompt !== "string" || prompt.trim() === "") {
    throw new Error(
      [
        `[agentApi] Agent has no systemPrompt.`,
        `GET ${url}`,
        `Body: ${bodyText || "<empty>"}`,
      ].join("\n")
    );
  }

  return prompt;
}
