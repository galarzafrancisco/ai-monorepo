import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import StarRating from "../components/StarRating";
import { McpRegistryService } from "../lib/api";
import type { ServerResponseDto, ScopeResponseDto, ConnectionResponseDto, MappingResponseDto } from "shared";

// Colourful tag helper
const Tag = ({ text, color }: { text: string; color: string }) => (
  <span className={`inline-block rounded-md px-2 py-1 text-xs font-semibold ${color}`}>{text}</span>
);

export default function ServerDetailPage() {
  const { id } = useParams();

  const [server, setServer] = useState<ServerResponseDto | null>(null);
  const [scopes, setScopes] = useState<ScopeResponseDto[]>([]);
  const [connections, setConnections] = useState<ConnectionResponseDto[]>([]);
  const [mappings, setMappings] = useState<MappingResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // fetch details
  useEffect(() => {
    if (!id) return;

    const loadServerDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load server details
        const serverData = await McpRegistryService.mcpRegistryControllerGetServer(id);
        setServer(serverData);

        // Load scopes and connections
        const [scopesData, connectionsData] = await Promise.all([
          McpRegistryService.mcpRegistryControllerListScopes(id),
          McpRegistryService.mcpRegistryControllerListConnections(id),
        ]);

        setScopes(scopesData);
        setConnections(connectionsData);

        // Load mappings for each scope (if there are scopes)
        if (scopesData.length > 0) {
          const allMappings: MappingResponseDto[] = [];
          for (const scope of scopesData) {
            try {
              const scopeMappings = await McpRegistryService.mcpRegistryControllerListMappings(id, scope.scopeId);
              allMappings.push(...scopeMappings);
            } catch {
              // Ignore errors for individual scopes
            }
          }
          setMappings(allMappings);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load server details");
        setServer(null);
      } finally {
        setLoading(false);
      }
    };

    loadServerDetails();
  }, [id]);

  /* render */
  if (loading) return <p className="text-white/60 p-4">Loading…</p>;

  if (error || !server) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 mb-4">{error || "Server not found"}</p>
        <Link to="/catalog" className="inline-flex items-center gap-2 text-sky-400 hover:underline">
          <ArrowLeft size={14} /> Back to catalog
        </Link>
      </div>
    );
  }

  // TODO: Backend doesn't support ratings yet, using placeholder data
  const rating = 4.2;
  const votes = 42;

  return (
    <div className="p-4">
      {/* back link */}
      <Link to="/catalog" className="inline-flex items-center gap-2 text-sky-400 hover:underline mb-6">
        <ArrowLeft size={14} /> Back
      </Link>

      {/* Name */}
      <div className="mb-2 flex items-start gap-3">
        <h1 className="text-2xl md:text-3xl font-extrabold break-words">{server.name}</h1>
      </div>

      {/* rating */}
      <div className="flex gap-6 mb-4">
        <StarRating rating={rating} votes={votes} />
      </div>

      {/* tags */}
      <div className="mb-10 flex flex-wrap gap-2">
        <Tag text="Local" color="bg-emerald-600" />
      </div>

      {/* Description */}
      <div className="mb-6">
        <p className="text-white/80">{server.description}</p>
      </div>

      {/* Server IDs */}
      <div className="mb-8 space-y-2">
        <div>
          <span className="text-sm font-semibold text-white/70">Server ID: </span>
          <span className="text-white/80 font-mono text-sm">{server.id}</span>
        </div>
        <div>
          <span className="text-sm font-semibold text-white/70">Provided ID: </span>
          <span className="text-white/80 font-mono text-sm">{server.providedId}</span>
        </div>
      </div>

      {/* Scopes, Connections, and Mappings sections */}
      <div className="space-y-8">
        {/* Scopes Section */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">Scopes</h2>
          {scopes.length === 0 ? (
            <p className="text-white/60 text-sm">No scopes defined</p>
          ) : (
            <div className="space-y-3">
              {scopes.map((scope) => (
                <div key={scope.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <h3 className="font-semibold">{scope.scopeId}</h3>
                  <p className="text-sm text-white/70">{scope.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connections Section */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4">OAuth Connections</h2>
          {connections.length === 0 ? (
            <p className="text-white/60 text-sm">No connections configured</p>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div key={connection.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <h3 className="font-semibold">{connection.friendlyName}</h3>
                  <p className="text-sm text-white/70">Client ID: {connection.clientId}</p>
                  <p className="text-sm text-white/60">Authorize: {connection.authorizeUrl}</p>
                  <p className="text-sm text-white/60">Token: {connection.tokenUrl}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mappings Section */}
        {connections.length > 0 && scopes.length > 0 && (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
            <h2 className="text-xl font-bold mb-4">Scope Mappings</h2>
            {mappings.length === 0 ? (
              <p className="text-white/60 text-sm">No mappings configured</p>
            ) : (
              <div className="space-y-3">
                {mappings.map((mapping) => {
                  const scope = scopes.find((s) => s.scopeId === mapping.scopeId);
                  const connection = connections.find((c) => c.id === mapping.connectionId);
                  return (
                    <div key={mapping.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <h3 className="font-semibold">{scope?.scopeId || mapping.scopeId}</h3>
                      <p className="text-sm text-white/70">→ {mapping.downstreamScope}</p>
                      <p className="text-sm text-white/60">via {connection?.friendlyName || "Unknown"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
