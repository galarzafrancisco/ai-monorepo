import { useState } from 'react';
import type { AgentAvatarDto } from '@taico/client/v2';
import { PopShell } from '../../app/shells/PopShell';
import { Text } from '../../ui/primitives';
import { AgentAvatarPicker } from './AgentAvatarPicker';

type EditAgentAvatarPopProps = {
  avatars: AgentAvatarDto[];
  initialValue?: string | null;
  onCancel?: () => void;
  onSave: (payload: { avatarUrl: string }) => Promise<boolean>;
};

export function EditAgentAvatarPop({
  avatars,
  initialValue,
  onCancel,
  onSave,
}: EditAgentAvatarPopProps) {
  const [avatarUrl, setAvatarUrl] = useState(initialValue ?? avatars[0]?.url ?? '');

  async function handleSave(): Promise<boolean> {
    if (!avatarUrl) {
      return false;
    }

    return onSave({ avatarUrl });
  }

  return (
    <PopShell title="Choose Avatar" onCancel={onCancel} onSave={handleSave}>
      <AgentAvatarPicker avatars={avatars} selectedUrl={avatarUrl} onSelect={setAvatarUrl} />
    </PopShell>
  );
}
