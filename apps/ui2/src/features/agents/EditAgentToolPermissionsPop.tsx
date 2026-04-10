import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Avatar, Text, Stack, Button } from "../../ui/primitives";
import { ToolsService, AgentToolPermissionsService } from "./api";
import type { ServerResponseDto, ScopeResponseDto } from "@taico/client/v2";
import "../actors/ActorSearchPop.css";
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
  editingPermission?: ToolPermission | null;
  onDelete?: () => Promise<void>;
  fixedTool?: {
    serverId: string;
    serverName: string;
    serverProvidedId: string;
    serverType: 'http' | 'stdio';
  } | null;
  title?: string;
  saveLabel?: string;
};

export function EditAgentToolPermissionsPop({
  agentActorId,
  currentPermissions,
  onCancel,
  onSave,
  editingPermission = null,
  onDelete,
  fixedTool = null,
  title,
  saveLabel,
}: EditAgentToolPermissionsPopProps) {
  const [availableTools, setAvailableTools] = useState<ServerResponseDto[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedToolId, setSelectedToolId] = useState<string>(fixedTool?.serverId || editingPermission?.serverId || '');
  const [availableScopes, setAvailableScopes] = useState<ScopeResponseDto[]>([]);
  const [loadingScopes, setLoadingScopes] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(
    editingPermission ? new Set(editingPermission.scopeIds) : new Set()
  );
  const [selectAllScopes, setSelectAllScopes] = useState(editingPermission?.hasAllScopes || false);
  const [isSaving, setIsSaving] = useState(false);
  const isEditMode = !!editingPermission;
  const isFixedToolMode = !!fixedTool;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
  const requiresScopeSelection = Boolean(isHttpTool && availableScopes.length > 0);
  const assignedToolIds = new Set(currentPermissions.map(p => p.serverId));
  const unassignedTools = availableTools.filter(t =>
    !assignedToolIds.has(t.id) || (isEditMode && editingPermission && t.id === editingPermission.serverId)
  );
  const filteredTools = useMemo(() => {
    if (isEditMode || isFixedToolMode) {
      return unassignedTools;
    }

    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return unassignedTools;
    }

    return unassignedTools.filter((tool) => {
      return (
        tool.name.toLowerCase().includes(trimmedQuery) ||
        tool.type.toLowerCase().includes(trimmedQuery) ||
        tool.description.toLowerCase().includes(trimmedQuery)
      );
    });
  }, [isEditMode, isFixedToolMode, query, unassignedTools]);

  useEffect(() => {
    if (!isEditMode && !isFixedToolMode) {
      inputRef.current?.focus();
    }
  }, [isEditMode, isFixedToolMode]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredTools.length, query]);

  useEffect(() => {
    if (!listRef.current || isEditMode || isFixedToolMode) {
      return;
    }

    const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    highlightedEl?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isEditMode, isFixedToolMode]);

  // Load scopes when tool is selected
  useEffect(() => {
    if (selectedToolId && isHttpTool) {
      setLoadingScopes(true);
      ToolsService.McpRegistryController_listScopes({ serverId: selectedToolId })
        .then(scopes => {
          setAvailableScopes(scopes);
          // In edit mode, preserve the selected scopes after loading available scopes
          if (editingPermission && editingPermission.serverId === selectedToolId) {
            setSelectedScopes(new Set(editingPermission.scopeIds));
            setSelectAllScopes(editingPermission.hasAllScopes);
          }
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
      // Only reset scopes if not in edit mode
      if (!isEditMode && !isFixedToolMode) {
        setSelectedScopes(new Set());
        setSelectAllScopes(false);
      }
    }
  }, [selectedToolId, isHttpTool, editingPermission, isEditMode, isFixedToolMode]);

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

  const handleAddPermission = useCallback(async (): Promise<boolean> => {
    if (!selectedToolId) {
      return false;
    }

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
      if (!isFixedToolMode && !isEditMode) {
        setSelectedToolId('');
      }
      setSelectedScopes(new Set());
      setSelectAllScopes(false);

      // Refresh parent
      await onSave();
      return true;
    } catch (err) {
      console.error('Failed to add permission:', err);
      alert('Failed to add tool permission');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [agentActorId, isEditMode, isFixedToolMode, onSave, requiresScopeSelection, selectedScopes, selectedToolId]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || filteredTools.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredTools.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        event.preventDefault();
        setSelectedToolId(filteredTools[highlightedIndex]?.id ?? '');
        break;
    }
  }, [filteredTools, highlightedIndex]);

  return (
    <PopShell
      title={title ?? (isEditMode ? "Edit Tool Permission" : "Select Scopes")}
      onCancel={onCancel}
      onSave={handleAddPermission}
      headerRight={saveLabel ? (
        <div
          onClick={() => {
            void handleAddPermission();
          }}
          style={{ opacity: isSaving ? 0.5 : 1, pointerEvents: isSaving ? "none" : "auto" }}
        >
          <Text size="4" weight="normal" className="pop-shell__main-title-button">
            {isSaving ? "saving" : saveLabel}
          </Text>
        </div>
      ) : undefined}
    >
      <div className="actor-search-pop">
        <Stack spacing="2">
          {loadingTools ? (
            <Text size="2" tone="muted">Loading available tools...</Text>
          ) : unassignedTools.length === 0 ? (
            <Text size="2" tone="muted">All available tools already assigned</Text>
          ) : (
            <>
              {!isEditMode && !isFixedToolMode ? (
                <>
                  <input
                    ref={inputRef}
                    type="text"
                    className="actor-search-pop__input"
                    placeholder="Search tools..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />

                  <div className="actor-search-pop__list" ref={listRef} role="listbox" aria-label="Tools">
                    {filteredTools.length === 0 ? (
                      <div className="actor-search-pop__empty">
                        <Text tone="muted" size="2">No tools found</Text>
                      </div>
                    ) : (
                      filteredTools.map((tool, index) => {
                        const isHighlighted = index === highlightedIndex;
                        const isSelected = tool.id === selectedToolId;

                        return (
                          <button
                            key={tool.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={`actor-search-pop__item ${(isHighlighted || isSelected) ? 'actor-search-pop__item--highlighted' : ''}`}
                            onClick={() => {
                              setSelectedToolId(tool.id);
                              setHighlightedIndex(index);
                            }}
                            onMouseEnter={() => setHighlightedIndex(index)}
                            disabled={isSaving}
                          >
                            <Avatar name={tool.name} size="sm" />
                            <div className="actor-search-pop__item-info">
                              <Text weight="medium" size="2">{tool.name}</Text>
                              <Text tone="muted" size="1">@{tool.providedId} · {tool.type}</Text>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="edit-agent-tool-permissions-pop__selected-tool">
                  <Text size="2" weight="medium">{selectedTool?.name ?? fixedTool?.serverName ?? editingPermission?.serverName}</Text>
                  <Text size="1" tone="muted">{selectedTool?.description ?? 'Update the scopes for this tool.'}</Text>
                </div>
              )}

              {/* Scope selection for HTTP tools */}
              {selectedToolId && isHttpTool && availableScopes.length > 0 && (
                <div className="edit-agent-tool-permissions-pop__scopes">
                  <Text size="2" weight="medium">Select Scopes</Text>

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

              {selectedToolId && isHttpTool && availableScopes.length === 0 && !loadingScopes && (
                <Text size="2" tone="muted">
                  This HTTP tool does not define scopes. Access will be granted without scope selection.
                </Text>
              )}

              {selectedToolId && !isHttpTool && (
                <Text size="2" tone="muted">
                  This STDIO tool does not require scope configuration.
                </Text>
              )}

              {selectedToolId && isEditMode && onDelete && (
                <Stack spacing="2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void onDelete();
                    }}
                  >
                    Remove Tool
                  </Button>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </div>
    </PopShell>
  );
}
