import { useState, useEffect } from "react";
import { McpRegistryService } from "../lib/api";
import type { ServerResponseDto } from "shared";

export default function CatalogPage() {
  const [servers, setServers] = useState<ServerResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerResponseDto | null>(null);

  useEffect(() => {
    loadServers();
  }, []);

  const loadServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await McpRegistryService.mcpRegistryControllerListServers();
      setServers(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load servers");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-white/60">Loading servers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="text-red-400">Error: {error}</div>
        <button
          onClick={loadServers}
          className="mt-4 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">MCP Catalog</h1>
        <p className="text-white/60">
          Browse and manage Model Context Protocol servers
        </p>
      </div>

      {servers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60 mb-4">No servers registered yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => (
            <div
              key={server.id}
              onClick={() => setSelectedServer(server)}
              className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 cursor-pointer transition-colors"
            >
              <h3 className="text-xl font-semibold mb-2">{server.name}</h3>
              {server.description && (
                <p className="text-white/60 text-sm line-clamp-3">
                  {server.description}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedServer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#0b1220] border border-white/10 rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-3xl font-bold">{selectedServer.name}</h2>
              <button
                onClick={() => setSelectedServer(null)}
                className="text-white/60 hover:text-white"
              >
                ✕
              </button>
            </div>

            {selectedServer.description && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white/70 mb-2">
                  Description
                </h3>
                <p className="text-white/80">{selectedServer.description}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white/70 mb-1">
                  Server ID
                </h3>
                <p className="text-white/80 font-mono text-sm">
                  {selectedServer.id}
                </p>
              </div>
              {selectedServer.providedId && (
                <div>
                  <h3 className="text-sm font-semibold text-white/70 mb-1">
                    Provided ID
                  </h3>
                  <p className="text-white/80 font-mono text-sm">
                    {selectedServer.providedId}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
