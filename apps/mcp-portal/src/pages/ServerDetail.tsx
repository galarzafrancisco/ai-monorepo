import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import StarRating from "../components/StarRating";
import { McpRegistryService } from "../lib/api";
import type { ServerResponseDto, ScopeResponseDto, ConnectionResponseDto, MappingResponseDto, CreateScopeDto, CreateConnectionDto, CreateMappingDto, AuthJourneyResponseDto } from "shared";
import { AuthJourneyResponseDto as AuthJourneyTypes, McpFlowResponseDto as McpFlowTypes } from "shared";

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
  const [authJourneys, setAuthJourneys] = useState<AuthJourneyResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states for creating new items
  const [showScopeForm, setShowScopeForm] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [showMappingForm, setShowMappingForm] = useState(false);

  // Scope form
  const [newScopeId, setNewScopeId] = useState("");
  const [newScopeDesc, setNewScopeDesc] = useState("");
  const [scopeError, setScopeError] = useState<string | null>(null);

  // Connection form
  const [newConnName, setNewConnName] = useState("");
  const [newConnClientId, setNewConnClientId] = useState("");
  const [newConnClientSecret, setNewConnClientSecret] = useState("");
  const [newConnAuthUrl, setNewConnAuthUrl] = useState("");
  const [newConnTokenUrl, setNewConnTokenUrl] = useState("");
  const [connError, setConnError] = useState<string | null>(null);

  // Mapping form
  const [newMappingScopeId, setNewMappingScopeId] = useState("");
  const [newMappingConnId, setNewMappingConnId] = useState("");
  const [newMappingDownstream, setNewMappingDownstream] = useState("");
  const [mappingError, setMappingError] = useState<string | null>(null);

  // Handler functions
  const handleCreateScope = async () => {
    if (!id || !newScopeId.trim() || !newScopeDesc.trim()) return;
    setScopeError(null);
    try {
      const dto: CreateScopeDto = {
        scopeId: newScopeId,
        description: newScopeDesc,
      };
      await McpRegistryService.mcpRegistryControllerCreateScopes(id, [dto]);
      // Reload scopes
      const scopesData = await McpRegistryService.mcpRegistryControllerListScopes(id);
      setScopes(scopesData);
      // Reset form
      setNewScopeId("");
      setNewScopeDesc("");
      setShowScopeForm(false);
    } catch (err) {
      setScopeError(err instanceof Error ? err.message : "Failed to create scope");
    }
  };

  const handleCreateConnection = async () => {
    if (!id || !newConnName.trim() || !newConnClientId.trim() || !newConnClientSecret.trim() || !newConnAuthUrl.trim() || !newConnTokenUrl.trim()) return;
    setConnError(null);
    try {
      const dto: CreateConnectionDto = {
        friendlyName: newConnName,
        clientId: newConnClientId,
        clientSecret: newConnClientSecret,
        authorizeUrl: newConnAuthUrl,
        tokenUrl: newConnTokenUrl,
      };
      await McpRegistryService.mcpRegistryControllerCreateConnection(id, dto);
      // Reload connections
      const connectionsData = await McpRegistryService.mcpRegistryControllerListConnections(id);
      setConnections(connectionsData);
      // Reset form
      setNewConnName("");
      setNewConnClientId("");
      setNewConnClientSecret("");
      setNewConnAuthUrl("");
      setNewConnTokenUrl("");
      setShowConnectionForm(false);
    } catch (err) {
      setConnError(err instanceof Error ? err.message : "Failed to create connection");
    }
  };

  const handleCreateMapping = async () => {
    if (!id || !newMappingScopeId.trim() || !newMappingConnId.trim() || !newMappingDownstream.trim()) return;
    setMappingError(null);
    try {
      const dto: CreateMappingDto = {
        scopeId: newMappingScopeId,
        connectionId: newMappingConnId,
        downstreamScope: newMappingDownstream,
      };
      await McpRegistryService.mcpRegistryControllerCreateMapping(id, dto);
      // Reload mappings for all scopes
      const allMappings: MappingResponseDto[] = [];
      for (const scope of scopes) {
        try {
          const scopeMappings = await McpRegistryService.mcpRegistryControllerListMappings(id, scope.scopeId);
          allMappings.push(...scopeMappings);
        } catch {
          // Ignore errors for individual scopes
        }
      }
      setMappings(allMappings);
      // Reset form
      setNewMappingScopeId("");
      setNewMappingConnId("");
      setNewMappingDownstream("");
      setShowMappingForm(false);
    } catch (err) {
      setMappingError(err instanceof Error ? err.message : "Failed to create mapping");
    }
  };

  const handleDeleteScope = async (scopeId: string) => {
    if (!id || !confirm(`Delete scope '${scopeId}'? This will fail if there are any mappings.`)) return;
    try {
      await McpRegistryService.mcpRegistryControllerDeleteScope(id, scopeId);
      // Reload scopes
      const scopesData = await McpRegistryService.mcpRegistryControllerListScopes(id);
      setScopes(scopesData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete scope");
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm("Delete this connection? This will fail if there are any mappings.")) return;
    try {
      await McpRegistryService.mcpRegistryControllerDeleteConnection(connectionId);
      // Reload connections
      if (!id) return;
      const connectionsData = await McpRegistryService.mcpRegistryControllerListConnections(id);
      setConnections(connectionsData);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete connection");
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm("Delete this mapping?")) return;
    try {
      await McpRegistryService.mcpRegistryControllerDeleteMapping(mappingId);
      // Reload mappings
      if (!id) return;
      const allMappings: MappingResponseDto[] = [];
      for (const scope of scopes) {
        try {
          const scopeMappings = await McpRegistryService.mcpRegistryControllerListMappings(id, scope.scopeId);
          allMappings.push(...scopeMappings);
        } catch {
          // Ignore errors for individual scopes
        }
      }
      setMappings(allMappings);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete mapping");
    }
  };

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

        // Load scopes, connections, and auth journeys
        const [scopesData, connectionsData, authJourneysData] = await Promise.all([
          McpRegistryService.mcpRegistryControllerListScopes(id),
          McpRegistryService.mcpRegistryControllerListConnections(id),
          McpRegistryService.mcpRegistryControllerGetAuthJourneys(id).catch(() => []),
        ]);

        setScopes(scopesData);
        setConnections(connectionsData);
        setAuthJourneys(authJourneysData);

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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Scopes</h2>
            <button
              onClick={() => setShowScopeForm(!showScopeForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
            >
              <Plus size={16} />
              Add Scope
            </button>
          </div>

          {showScopeForm && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4 space-y-3">
              <div>
                <label className="block text-sm mb-1">Scope ID *</label>
                <input
                  value={newScopeId}
                  onChange={(e) => setNewScopeId(e.target.value)}
                  placeholder="e.g., tool:read"
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Description *</label>
                <textarea
                  value={newScopeDesc}
                  onChange={(e) => setNewScopeDesc(e.target.value)}
                  placeholder="What does this scope grant access to?"
                  rows={2}
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/50 text-sm"
                />
              </div>
              {scopeError && <p className="text-red-400 text-sm">{scopeError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateScope}
                  disabled={!newScopeId.trim() || !newScopeDesc.trim()}
                  className="px-3 py-1.5 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowScopeForm(false);
                    setNewScopeId("");
                    setNewScopeDesc("");
                    setScopeError(null);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {scopes.length === 0 ? (
            <p className="text-white/60 text-sm">No scopes defined</p>
          ) : (
            <div className="space-y-3">
              {scopes.map((scope) => (
                <div key={scope.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{scope.scopeId}</h3>
                    <p className="text-sm text-white/70">{scope.description}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteScope(scope.scopeId)}
                    className="ml-4 p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300"
                    title="Delete scope"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connections Section */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">OAuth Connections</h2>
            <button
              onClick={() => setShowConnectionForm(!showConnectionForm)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
            >
              <Plus size={16} />
              Add Connection
            </button>
          </div>

          {showConnectionForm && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4 space-y-3">
              <div>
                <label className="block text-sm mb-1">Friendly Name *</label>
                <input
                  value={newConnName}
                  onChange={(e) => setNewConnName(e.target.value)}
                  placeholder="e.g., GitHub OAuth Connection"
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Client ID *</label>
                <input
                  value={newConnClientId}
                  onChange={(e) => setNewConnClientId(e.target.value)}
                  placeholder="OAuth client ID"
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Client Secret *</label>
                <input
                  type="password"
                  value={newConnClientSecret}
                  onChange={(e) => setNewConnClientSecret(e.target.value)}
                  placeholder="OAuth client secret"
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Authorize URL *</label>
                <input
                  value={newConnAuthUrl}
                  onChange={(e) => setNewConnAuthUrl(e.target.value)}
                  placeholder="https://provider.com/oauth/authorize"
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/50 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Token URL *</label>
                <input
                  value={newConnTokenUrl}
                  onChange={(e) => setNewConnTokenUrl(e.target.value)}
                  placeholder="https://provider.com/oauth/token"
                  className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/50 text-sm"
                />
              </div>
              {connError && <p className="text-red-400 text-sm">{connError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateConnection}
                  disabled={!newConnName.trim() || !newConnClientId.trim() || !newConnClientSecret.trim() || !newConnAuthUrl.trim() || !newConnTokenUrl.trim()}
                  className="px-3 py-1.5 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowConnectionForm(false);
                    setNewConnName("");
                    setNewConnClientId("");
                    setNewConnClientSecret("");
                    setNewConnAuthUrl("");
                    setNewConnTokenUrl("");
                    setConnError(null);
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {connections.length === 0 ? (
            <p className="text-white/60 text-sm">No connections configured</p>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div key={connection.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold">{connection.friendlyName}</h3>
                    <p className="text-sm text-white/70">Client ID: {connection.clientId}</p>
                    <p className="text-sm text-white/60">Authorize: {connection.authorizeUrl}</p>
                    <p className="text-sm text-white/60">Token: {connection.tokenUrl}</p>
                  </div>
                  <button
                    onClick={() => handleDeleteConnection(connection.id)}
                    className="ml-4 p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300"
                    title="Delete connection"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mappings Section */}
        {connections.length > 0 && scopes.length > 0 && (
          <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Scope Mappings</h2>
              <button
                onClick={() => setShowMappingForm(!showMappingForm)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
              >
                <Plus size={16} />
                Add Mapping
              </button>
            </div>

            {showMappingForm && (
              <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <label className="block text-sm mb-1">MCP Scope *</label>
                  <select
                    value={newMappingScopeId}
                    onChange={(e) => setNewMappingScopeId(e.target.value)}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm"
                  >
                    <option value="">Select a scope</option>
                    {scopes.map((scope) => (
                      <option key={scope.id} value={scope.scopeId}>
                        {scope.scopeId}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">OAuth Connection *</label>
                  <select
                    value={newMappingConnId}
                    onChange={(e) => setNewMappingConnId(e.target.value)}
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white text-sm"
                  >
                    <option value="">Select a connection</option>
                    {connections.map((conn) => (
                      <option key={conn.id} value={conn.id}>
                        {conn.friendlyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Downstream Scope *</label>
                  <input
                    value={newMappingDownstream}
                    onChange={(e) => setNewMappingDownstream(e.target.value)}
                    placeholder="e.g., repo:read"
                    className="w-full rounded-md bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/50 text-sm"
                  />
                </div>
                {mappingError && <p className="text-red-400 text-sm">{mappingError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateMapping}
                    disabled={!newMappingScopeId.trim() || !newMappingConnId.trim() || !newMappingDownstream.trim()}
                    className="px-3 py-1.5 bg-gradient-to-r from-sky-600 to-teal-500 hover:from-sky-500 hover:to-teal-400 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowMappingForm(false);
                      setNewMappingScopeId("");
                      setNewMappingConnId("");
                      setNewMappingDownstream("");
                      setMappingError(null);
                    }}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {mappings.length === 0 ? (
              <p className="text-white/60 text-sm">No mappings configured</p>
            ) : (
              <div className="space-y-3">
                {mappings.map((mapping) => {
                  const scope = scopes.find((s) => s.scopeId === mapping.scopeId);
                  const connection = connections.find((c) => c.id === mapping.connectionId);
                  return (
                    <div key={mapping.id} className="bg-white/5 border border-white/10 rounded-lg p-4 flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{scope?.scopeId || mapping.scopeId}</h3>
                        <p className="text-sm text-white/70">→ {mapping.downstreamScope}</p>
                        <p className="text-sm text-white/60">via {connection?.friendlyName || "Unknown"}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteMapping(mapping.id)}
                        className="ml-4 p-2 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300"
                        title="Delete mapping"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Auth Journeys Section (Debug/Monitoring) */}
        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">Client Connections & Auth Flows</h2>
              <p className="text-sm text-white/60 mt-1">Live monitoring of client connections and their authorization state</p>
            </div>
          </div>

          {authJourneys.length === 0 ? (
            <p className="text-white/60 text-sm">No active client connections</p>
          ) : (
            <div className="space-y-4">
              {authJourneys.map((journey) => (
                <div key={journey.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  {/* Journey header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{journey.mcpAuthorizationFlow.clientName ?? 'Unknown Client'}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          journey.status === AuthJourneyTypes.status.AUTHORIZATION_CODE_EXCHANGED ? 'bg-green-500/20 text-green-300' :
                          journey.status === AuthJourneyTypes.status.MCP_AUTH_FLOW_STARTED ? 'bg-blue-500/20 text-blue-300' :
                          journey.status === AuthJourneyTypes.status.CONNECTIONS_FLOW_STARTED ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>
                          {journey.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-white/50 space-y-0.5">
                        <div>Journey ID: {journey.id}</div>
                        <div>Started: {new Date(journey.createdAt).toLocaleString()}</div>
                        <div>Last Update: {new Date(journey.updatedAt).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>

                  {/* MCP Auth Flow Details */}
                  <div className="mb-3 pl-4 border-l-2 border-white/10">
                    <div className="text-sm font-medium text-white/80 mb-1">MCP Authorization</div>
                    <div className="text-xs text-white/60 space-y-0.5">
                      <div>Status: <span className={`font-medium ${
                        journey.mcpAuthorizationFlow.status === McpFlowTypes.status.AUTHORIZATION_CODE_EXCHANGED ? 'text-green-400' :
                        journey.mcpAuthorizationFlow.status === McpFlowTypes.status.CLIENT_REGISTERED ? 'text-blue-400' :
                        'text-gray-400'
                      }`}>{journey.mcpAuthorizationFlow.status.replace(/_/g, ' ')}</span></div>
                      {journey.mcpAuthorizationFlow.scope && <div>Scopes: {journey.mcpAuthorizationFlow.scope}</div>}
                      {journey.mcpAuthorizationFlow.authorizationCodeExpiresAt && (
                        <div>Code Expires: {new Date(journey.mcpAuthorizationFlow.authorizationCodeExpiresAt).toLocaleString()}</div>
                      )}
                      <div>Code Used: {journey.mcpAuthorizationFlow.authorizationCodeUsed ? 'Yes' : 'No'}</div>
                    </div>
                  </div>

                  {/* Connection Flows */}
                  {journey.connectionAuthorizationFlows.length > 0 && (
                    <div className="pl-4 border-l-2 border-white/10">
                      <div className="text-sm font-medium text-white/80 mb-2">Downstream Connections ({journey.connectionAuthorizationFlows.length})</div>
                      <div className="space-y-2">
                        {journey.connectionAuthorizationFlows.map((connFlow) => (
                          <div key={connFlow.id} className="bg-white/5 rounded px-3 py-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium">{connFlow.connectionName ?? 'Unknown Connection'}</span>
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                connFlow.status === 'authorized' ? 'bg-green-500/20 text-green-300' :
                                connFlow.status === 'pending' ? 'bg-yellow-500/20 text-yellow-300' :
                                'bg-red-500/20 text-red-300'
                              }`}>
                                {connFlow.status}
                              </span>
                            </div>
                            <div className="text-xs text-white/50 space-y-0.5">
                              {connFlow.tokenExpiresAt && (
                                <div>Token Expires: {new Date(connFlow.tokenExpiresAt).toLocaleString()}</div>
                              )}
                              <div>Created: {new Date(connFlow.createdAt).toLocaleString()}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
