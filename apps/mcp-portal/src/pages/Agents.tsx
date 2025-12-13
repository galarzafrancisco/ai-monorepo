import { useState, useEffect } from "react";
import { AgentService } from "../lib/api";
import type { AgentResponseDto, CreateAgentDto } from "shared";

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await AgentService.agentsControllerListAgents();
      setAgents(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agents");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const data: CreateAgentDto = {
      slug: name.toLowerCase().replace(/\s+/g, '-'),
      name: name,
      systemPrompt: formData.get("systemPrompt") as string,
      allowedTools: [],
    };

    setCreating(true);
    setError(null);
    try {
      await AgentService.agentsControllerCreateAgent(data);
      await loadAgents();
      setShowCreateForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-white/60">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold mb-2">Agents</h1>
          <p className="text-white/60">Manage your AI agents and chat sessions</p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 rounded-lg"
        >
          + Create Agent
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {agents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60 mb-4">No agents created yet</p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
          >
            Create your first agent
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
            >
              <h3 className="text-xl font-semibold mb-2">{agent.name}</h3>
              {agent.systemPrompt && (
                <p className="text-white/60 text-sm mb-4 line-clamp-3">
                  {agent.systemPrompt}
                </p>
              )}
              {agent.allowedTools && agent.allowedTools.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-white/50">
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded">
                    {agent.allowedTools.length} tools
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b1220] border border-white/10 rounded-2xl p-8 max-w-2xl w-full">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-3xl font-bold">Create New Agent</h2>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-white/60 hover:text-white"
                disabled={creating}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-white/70 mb-2">
                  Agent Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="My Assistant"
                  disabled={creating}
                />
              </div>

              <div>
                <label htmlFor="systemPrompt" className="block text-sm font-semibold text-white/70 mb-2">
                  System Prompt
                </label>
                <textarea
                  id="systemPrompt"
                  name="systemPrompt"
                  rows={6}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  placeholder="You are a helpful assistant..."
                  disabled={creating}
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 rounded-lg disabled:opacity-50"
                  disabled={creating}
                >
                  {creating ? "Creating..." : "Create Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
