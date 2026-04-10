import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { ScopeResponseDto, ServerResponseDto } from "@taico/client/v2";
import { PopShell } from "../../app/shells/PopShell";
import { Avatar, Text } from "../../ui/primitives";
import { ToolsService } from "./api";
import "../actors/ActorSearchPop.css";

type ToolPermission = {
  serverId: string;
};

type AddAgentToolPermissionPopProps = {
  currentPermissions: ToolPermission[];
  onCancel?: () => void;
  onSaveUnscopedTool: (tool: ServerResponseDto) => Promise<void>;
  onConfigureScopedTool: (tool: ServerResponseDto, scopes: ScopeResponseDto[]) => void;
};

export function AddAgentToolPermissionPop({
  currentPermissions,
  onCancel,
  onSaveUnscopedTool,
  onConfigureScopedTool,
}: AddAgentToolPermissionPopProps) {
  const [availableTools, setAvailableTools] = useState<ServerResponseDto[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [selectedToolId, setSelectedToolId] = useState<string>("");
  const [selectedToolScopes, setSelectedToolScopes] = useState<ScopeResponseDto[]>([]);
  const [loadingScopes, setLoadingScopes] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const loadTools = async () => {
      setLoadingTools(true);
      try {
        const result = await ToolsService.McpRegistryController_listServers({});
        setAvailableTools(result.items);
      } catch (err) {
        console.error("Failed to load tools:", err);
      } finally {
        setLoadingTools(false);
      }
    };

    void loadTools();
  }, []);

  const assignedToolIds = new Set(currentPermissions.map((permission) => permission.serverId));
  const unassignedTools = useMemo(
    () => availableTools.filter((tool) => !assignedToolIds.has(tool.id)),
    [availableTools, assignedToolIds],
  );

  const filteredTools = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      return unassignedTools;
    }

    return unassignedTools.filter((tool) =>
      tool.name.toLowerCase().includes(trimmedQuery) ||
      tool.type.toLowerCase().includes(trimmedQuery) ||
      tool.description.toLowerCase().includes(trimmedQuery) ||
      tool.providedId.toLowerCase().includes(trimmedQuery),
    );
  }, [query, unassignedTools]);

  const selectedTool = filteredTools.find((tool) => tool.id === selectedToolId) ??
    unassignedTools.find((tool) => tool.id === selectedToolId) ??
    null;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredTools.length, query]);

  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    highlightedEl?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  useEffect(() => {
    if (!selectedTool || selectedTool.type !== "http") {
      setSelectedToolScopes([]);
      setLoadingScopes(false);
      return;
    }

    let cancelled = false;
    setLoadingScopes(true);

    ToolsService.McpRegistryController_listScopes({ serverId: selectedTool.id })
      .then((scopes) => {
        if (!cancelled) {
          setSelectedToolScopes(scopes);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Failed to load scopes:", err);
          setSelectedToolScopes([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingScopes(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTool]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || filteredTools.length === 0) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredTools.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
        event.preventDefault();
        setSelectedToolId(filteredTools[highlightedIndex]?.id ?? "");
        break;
    }
  }, [filteredTools, highlightedIndex]);

  const handlePrimaryAction = useCallback(async () => {
    if (!selectedTool || loadingScopes || isSaving) {
      return;
    }

    if (selectedTool.type === "http" && selectedToolScopes.length > 0) {
      onConfigureScopedTool(selectedTool, selectedToolScopes);
      onCancel?.();
      return;
    }

    setIsSaving(true);
    try {
      await onSaveUnscopedTool(selectedTool);
      onCancel?.();
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, loadingScopes, onCancel, onConfigureScopedTool, onSaveUnscopedTool, selectedTool, selectedToolScopes]);

  const primaryLabel = selectedTool?.type === "http" && selectedToolScopes.length > 0 ? "next" : (isSaving ? "saving" : "save");

  return (
    <PopShell
      title="Add Tool"
      onCancel={onCancel}
      headerRight={(
        <div
          onClick={() => {
            void handlePrimaryAction();
          }}
          style={{ opacity: !selectedTool || loadingScopes || isSaving ? 0.5 : 1, pointerEvents: !selectedTool || loadingScopes || isSaving ? "none" : "auto" }}
        >
          <Text size="4" weight="normal" className="pop-shell__main-title-button">
            {primaryLabel}
          </Text>
        </div>
      )}
    >
      <div className="actor-search-pop">
        {loadingTools ? (
          <div className="actor-search-pop__empty">
            <Text tone="muted">Loading tools...</Text>
          </div>
        ) : unassignedTools.length === 0 ? (
          <div className="actor-search-pop__empty">
            <Text tone="muted">All available tools already assigned</Text>
          </div>
        ) : (
          <>
            <input
              ref={inputRef}
              type="text"
              className="actor-search-pop__input"
              placeholder="Search tools..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
            />

            <div className="actor-search-pop__list" ref={listRef} role="listbox" aria-label="Tools">
              {filteredTools.length === 0 ? (
                <div className="actor-search-pop__empty">
                  <Text tone="muted">No tools found</Text>
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
                      className={`actor-search-pop__item ${(isHighlighted || isSelected) ? "actor-search-pop__item--highlighted" : ""}`}
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
        )}
      </div>
    </PopShell>
  );
}
