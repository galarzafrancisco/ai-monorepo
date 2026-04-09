import React, { useState, useEffect } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Text, Stack, Button, Chip } from "../../ui/primitives";
import { ToolsService, AgentToolPermissionsService } from "./api";
import type { ServerResponseDto, ScopeResponseDto } from "@taico/client/v2";
import "./EditAgentToolPermissionsPop.css";

type ToolPermission = {
  serverId: string;
  serverName: string;
  serverProvidedId: string;
  serverType: 'http' | 'stdio';
  scopeIds: string[];
  availableScopes: Array<{ id: string; description: string }>;
  hasAllScopes: boolean;
};

type EditAgentToolPermissionsPopProps = {
  agentActorId: string;
  currentPermissions: ToolPermission[];
  onCancel?: () => void;
  onSave: () => Promise<void>;
};

export function EditAgentToolPermissionsPop({
  agentActorId,
  currentPermissions,
  onCancel,
  onSave,
}: EditAgentToolPermissionsPopProps) {
  const [availableTools, setAvailableTools] = useState<ServerResponseDto[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [selectedToolId, setSelectedToolId] = useState<string>('');
  const [availableScopes, setAvailableScopes] = useState<ScopeResponseDto[]>([]);
  const [loadingScopes, setLoadingScopes] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [selectAllScopes, setSelectAllScopes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load available tools
  useEffect(() => {
    const loadTools = async () => {
      setLoadingTools(true);
      try {
        const result = await ToolsService.McpRegistryController_listServers({});
        setAvailableTools(result.items);
      } catch (err) {
        console.error('Failed to load tools:', err);
      } finally {
        setLoadingTools(false);
      }
    };
    loadTools();
  }, []);

  const selectedTool = availableTools.find(t => t.id === selectedToolId);
  const isHttpTool = selectedTool?.type === 'http';

  // Load scopes when tool is selected
  useEffect(() => {
    if (selectedToolId && isHttpTool) {
      setLoadingScopes(true);
      ToolsService.McpRegistryController_listScopes({ serverId: selectedToolId })
        .then(scopes => {
          setAvailableScopes(scopes);
        })
        .catch(err => {
          console.error('Failed to load scopes:', err);
          setAvailableScopes([]);
        })
        .finally(() => {
          setLoadingScopes(false);
        });
    } else {
      setAvailableScopes([]);
    }
    setSelectedScopes(new Set());
    setSelectAllScopes(false);
  }, [selectedToolId, isHttpTool]);

  // Handle "All scopes" toggle
  const handleAllScopesToggle = () => {
    const newValue = !selectAllScopes;
    setSelectAllScopes(newValue);
    if (newValue) {
      setSelectedScopes(new Set(availableScopes.map((s: ScopeResponseDto) => s.id)));
    } else {
      setSelectedScopes(new Set());
    }
  };

  // Toggle individual scope
  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(scopeId)) {
        newSet.delete(scopeId);
      } else {
        newSet.add(scopeId);
      }
      // Update "all scopes" checkbox state
      const allSelected = availableScopes.length > 0 && availableScopes.every((s: ScopeResponseDto) => newSet.has(s.id));
      setSelectAllScopes(allSelected);
      return newSet;
    });
  };

  const handleAddPermission = async () => {
    if (!selectedToolId) return;

    setIsSaving(true);
    try {
      await AgentToolPermissionsService.AgentToolPermissionsController_upsertAgentToolPermission({
        actorId: agentActorId,
        serverId: selectedToolId,
        body: {
          scopeIds: Array.from(selectedScopes),
        },
      });

      // Reset form
      setSelectedToolId('');
      setSelectedScopes(new Set());
      setSelectAllScopes(false);

      // Refresh parent
      await onSave();
    } catch (err) {
      console.error('Failed to add permission:', err);
      alert('Failed to add tool permission');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out tools that already have permissions
  const assignedToolIds = new Set(currentPermissions.map(p => p.serverId));
  const unassignedTools = availableTools.filter(t => !assignedToolIds.has(t.id));

  return (
    <PopShell
      title="Manage Tool Permissions"
      onCancel={onCancel}
      headerRight={
        <div onClick={onCancel}>
          <Text size="4" weight="normal" className="pop-shell__main-title-button">
            close
          </Text>
        </div>
      }
    >
      <div className="edit-agent-tool-permissions-pop__wrapper">
        <Stack spacing="4">
          {/* Add new tool */}
          <div>
            <Text size="3" weight="medium">Add Tool Permission</Text>
            <Stack spacing="2">
              {loadingTools ? (
                <Text size="2" tone="muted">Loading available tools...</Text>
              ) : unassignedTools.length === 0 ? (
                <Text size="2" tone="muted">All available tools already assigned</Text>
              ) : (
                <>
                  <select
                    className="edit-agent-tool-permissions-pop__select"
                    value={selectedToolId}
                    onChange={(e) => setSelectedToolId(e.target.value)}
                  >
                    <option value="">Select a tool...</option>
                    {unassignedTools.map(tool => (
                      <option key={tool.id} value={tool.id}>
                        {tool.name} ({tool.type})
                      </option>
                    ))}
                  </select>

                  {/* Scope selection for HTTP tools */}
                  {selectedToolId && isHttpTool && availableScopes.length > 0 && (
                    <div className="edit-agent-tool-permissions-pop__scopes">
                      <Text size="2" weight="medium">Select Scopes</Text>

                      {/* All scopes shortcut */}
                      <label className="edit-agent-tool-permissions-pop__scope-item">
                        <input
                          type="checkbox"
                          checked={selectAllScopes}
                          onChange={handleAllScopesToggle}
                        />
                        <div className="edit-agent-tool-permissions-pop__scope-info">
                          <Text size="2" weight="medium">All scopes</Text>
                          <Text size="1" tone="muted">Grant all available scopes</Text>
                        </div>
                      </label>

                      {/* Individual scopes */}
                      {availableScopes.map((scope: ScopeResponseDto) => (
                        <label key={scope.id} className="edit-agent-tool-permissions-pop__scope-item">
                          <input
                            type="checkbox"
                            checked={selectedScopes.has(scope.id)}
                            onChange={() => toggleScope(scope.id)}
                          />
                          <div className="edit-agent-tool-permissions-pop__scope-info">
                            <Text size="2" weight="medium" style="mono">{scope.id}</Text>
                            <Text size="1" tone="muted">{scope.description}</Text>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Info for STDIO tools */}
                  {selectedToolId && !isHttpTool && (
                    <Text size="2" tone="muted">
                      This STDIO tool does not require scope configuration.
                    </Text>
                  )}

                  {selectedToolId && (
                    <Button
                      size="sm"
                      onClick={handleAddPermission}
                      disabled={isSaving || (isHttpTool && selectedScopes.size === 0)}
                    >
                      {isSaving ? 'Adding...' : 'Add Permission'}
                    </Button>
                  )}
                </>
              )}
            </Stack>
          </div>
        </Stack>
      </div>
    </PopShell>
  );
}
