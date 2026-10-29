import { useState } from 'react';
import { DataRow, DataRowContainer, ErrorText, Switch, Text } from '../../ui/primitives';
import { TaicoAuthExplanation } from './TaicoAuthExplanation';
import { authTypeFromSwitch, usesTaicoAuth, type ToolAuthType } from './toolAuth';
import type { Tool } from './types';

type ToolAuthSectionProps = {
  tool: Tool;
  /** Persists the new auth type. Must throw if the change was not saved. */
  onSave: (authType: ToolAuthType) => Promise<Tool>;
  onSaved: (tool: Tool) => void;
  onError?: (error: unknown) => void;
  className?: string;
};

/**
 * The "Use Taico authentication" switch of an HTTP tool. When a save fails it
 * says so, and says which setting is still in effect, because that decides
 * whether agents send the server Taico credentials.
 */
export function ToolAuthSection({ tool, onSave, onSaved, onError, className }: ToolAuthSectionProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const isTaicoAuth = usesTaicoAuth(tool);

  const handleChange = async (checked: boolean) => {
    setIsSaving(true);
    setSaveFailed(false);
    try {
      onSaved(await onSave(authTypeFromSwitch(checked)));
    } catch (err) {
      setSaveFailed(true);
      onError?.(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DataRowContainer title="Authentication" className={className}>
      <DataRow
        trailing={
          <Switch
            id="tool-taico-auth"
            label="Use Taico authentication"
            checked={isTaicoAuth}
            disabled={isSaving}
            onCheckedChange={(checked) => { void handleChange(checked); }}
          />
        }
      >
        <Text size="2" weight="medium">Use Taico authentication</Text>
        <TaicoAuthExplanation />
        {saveFailed ? (
          <ErrorText size="1">
            {isTaicoAuth
              ? "Couldn't save the change. Taico authentication is still on: agents still send this server their Taico credentials."
              : "Couldn't save the change. Taico authentication is still off: agents still send this server no Taico credentials."}
          </ErrorText>
        ) : null}
      </DataRow>
    </DataRowContainer>
  );
}
