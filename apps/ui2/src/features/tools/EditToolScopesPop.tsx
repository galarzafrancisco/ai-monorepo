import React, { useState } from "react";
import { PopShell } from "../../app/shells/PopShell";
import { Text, Stack, Button } from "../../ui/primitives";
import { ToolScope } from "./types";
import "./EditToolScopesPop.css";

type EditToolScopesPopProps = {
  toolId: string;
  initialScopes: ToolScope[];
  onCancel?: () => void;
  onSave: (params: {
    scopesToCreate: Array<{ id: string; description: string }>;
    scopesToDelete: string[];
  }) => Promise<boolean>;
};

export function EditToolScopesPop({ toolId, initialScopes, onCancel, onSave }: EditToolScopesPopProps) {
  const [scopes, setScopes] = useState<ToolScope[]>(initialScopes);
  const [newScopeId, setNewScopeId] = useState('');
  const [newScopeDescription, setNewScopeDescription] = useState('');

  const addScope = () => {
    if (!newScopeId.trim() || !newScopeDescription.trim()) {
      return;
    }

    const newScope: ToolScope = {
      id: newScopeId.trim(),
      description: newScopeDescription.trim(),
      serverId: toolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setScopes([...scopes, newScope]);
    setNewScopeId('');
    setNewScopeDescription('');
  };

  const removeScope = (scopeId: string) => {
    setScopes(scopes.filter(s => s.id !== scopeId));
  };

  async function handleSave(): Promise<boolean> {
    // Determine which scopes to create and delete
    const initialScopeIds = new Set(initialScopes.map(s => s.id));
    const currentScopeIds = new Set(scopes.map(s => s.id));

    const scopesToCreate = scopes
      .filter(s => !initialScopeIds.has(s.id))
      .map(s => ({ id: s.id, description: s.description }));

    const scopesToDelete = initialScopes
      .filter(s => !currentScopeIds.has(s.id))
      .map(s => s.id);

    return onSave({ scopesToCreate, scopesToDelete });
  }

  return (
    <PopShell
      title="Edit Scopes"
      onCancel={onCancel}
      onSave={handleSave}
    >
      <>
        <div className="edit-tool-scopes-pop__wrapper">
          <Stack spacing="3">
            {/* Current scopes */}
            <div>
              <Text size="2" weight="medium">Current Scopes</Text>
              {scopes.length === 0 ? (
                <Text size="2" tone="muted">No scopes configured</Text>
              ) : (
                <div className="edit-tool-scopes-pop__scopes-list">
                  {scopes.map(scope => (
                    <div key={scope.id} className="edit-tool-scopes-pop__scope-item">
                      <div className="edit-tool-scopes-pop__scope-info">
                        <Text size="2" weight="medium" style="mono">{scope.id}</Text>
                        <Text size="1" tone="muted">{scope.description}</Text>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => removeScope(scope.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new scope */}
            <div>
              <Text size="2" weight="medium">Add New Scope</Text>
              <div className="edit-tool-scopes-pop__new-scope">
                <input
                  type="text"
                  className="edit-tool-scopes-pop__input"
                  placeholder="Scope ID (e.g., tool:read)"
                  value={newScopeId}
                  onChange={(e) => setNewScopeId(e.target.value)}
                />
                <input
                  type="text"
                  className="edit-tool-scopes-pop__input"
                  placeholder="Description"
                  value={newScopeDescription}
                  onChange={(e) => setNewScopeDescription(e.target.value)}
                />
                <Button
                  size="sm"
                  onClick={addScope}
                  disabled={!newScopeId.trim() || !newScopeDescription.trim()}
                >
                  Add Scope
                </Button>
              </div>
            </div>
          </Stack>
        </div>
      </>
    </PopShell>
  );
}
