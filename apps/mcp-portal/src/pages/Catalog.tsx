import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { McpRegistryService } from "../lib/api";
import type { ServerResponseDto } from "shared";
import StarRating from "../components/StarRating";
import NewServerModal from "../components/NewServerModal";

// Label badge with custom color
const Label = ({ text, color }: { text: string; color: string }) => (
  <span className={`text-xs font-semibold px-2 py-1 rounded-md ${color}`}>
    {text}
  </span>
);

// Server card
const ServerCard = ({ server }: { server: ServerResponseDto }) => {
  // TODO: Backend doesn't support ratings yet, using placeholder data
  const rating = 4.2;
  const votes = 42;

  return (
    <div className="rounded-2xl border border-white/10 backdrop-blur-xl bg-white/5 p-4 shadow-lg flex flex-col gap-3 w-full text-white max-w-sm">
      <div className="text-lg font-semibold flex items-center gap-2">
        {server.name}
      </div>
      <p className="text-sm text-white/70 line-clamp-3">{server.description}</p>
      {/* Votes & Tags */}
      <div className="flex items-center justify-between gap-4">
        {/* Votes */}
        <div className="flex items-center gap-4">
          <StarRating rating={rating} votes={votes} />
        </div>

        {/* Tags - placeholder for now */}
        <div className="flex flex-wrap items-center gap-2">
          <Label text="Local" color="bg-emerald-600" />
        </div>
      </div>
    </div>
  );
};

export default function CatalogPage() {
  const [servers, setServers] = useState<ServerResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewServerModal, setShowNewServerModal] = useState(false);

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
      <div className="p-4">
        <div className="text-white/60">Loading servers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
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
    <div className="p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-bold">MCP Catalog</h1>
        <button
          onClick={() => setShowNewServerModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 text-white rounded-lg font-medium"
        >
          <Plus size={20} />
          Create Server
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-8 items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="Search MCP servers"
          className="bg-white/10 border border-white/20 text-white px-4 py-2 h-10 rounded-lg placeholder-white/50 w-full sm:w-80"
          onChange={() => {}}
        />

        {/* Type toggle buttons as a segmented control */}
        <div className="bg-white/10 border border-white/20 text-white h-10 rounded-lg flex">
          <button
            type="button"
            className="px-4 text-sm text-white/50 hover:text-white transition-colors"
          >
            All
          </button>
          <button
            type="button"
            className="px-4 text-sm text-white/50 hover:text-white transition-colors border-l border-white/20"
          >
            Local
          </button>
          <button
            type="button"
            className="px-4 text-sm text-white/50 hover:text-white transition-colors border-l border-white/20"
          >
            Remote
          </button>
        </div>

        {/* Sort dropdown */}
        <select className="bg-white/10 border border-white/20 text-white text-sm px-4 h-10 rounded-md">
          <option>Sort by</option>
          <option>Rating</option>
          <option>Name</option>
          <option>Votes</option>
        </select>
      </div>

      {/* Cards */}
      {servers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60 mb-4">No servers registered yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map((server) => {
            return (
              <Link
                key={server.id}
                to={`/catalog/${server.id}`}
                className="hover:scale-[1.02] transition-transform"
              >
                <ServerCard server={server} />
              </Link>
            );
          })}
        </div>
      )}

      {showNewServerModal && (
        <NewServerModal
          onClose={() => setShowNewServerModal(false)}
          onSuccess={() => {
            setShowNewServerModal(false);
            loadServers();
          }}
        />
      )}
    </div>
  );
}
