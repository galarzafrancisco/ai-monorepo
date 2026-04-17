import type { AgentAvatarDto } from '@taico/client/v2';
import { Avatar, Text } from '../../ui/primitives';
import './AgentAvatarPicker.css';

type AgentAvatarPickerProps = {
  avatars: AgentAvatarDto[];
  selectedUrl?: string;
  onSelect: (avatarUrl: string) => void;
};

export function AgentAvatarPicker({ avatars, selectedUrl, onSelect }: AgentAvatarPickerProps) {
  return (
    <div className="agent-avatar-picker">
      {avatars.map((avatar) => {
        const isSelected = selectedUrl === avatar.url;

        return (
          <button
            key={avatar.id}
            type="button"
            className={`agent-avatar-picker__option ${isSelected ? 'agent-avatar-picker__option--selected' : ''}`}
            onClick={() => onSelect(avatar.url)}
            aria-pressed={isSelected}
          >
            <Avatar name={avatar.label} src={avatar.url} size={64} className="agent-avatar-picker__image" />
            <Text size="2" weight="medium">{avatar.label}</Text>
          </button>
        );
      })}
    </div>
  );
}
