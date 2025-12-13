import { useEffect, useRef } from 'react';
import type { SlashCommand } from './types';
import './Wikiroo.css';

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  selectedIndex: number;
  position: { x: number; y: number };
  onSelect: (command: SlashCommand) => void;
  onCancel: () => void;
}

export function SlashCommandMenu({
  commands,
  selectedIndex,
  position,
  onSelect,
  onCancel,
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  if (commands.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      className="slash-command-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      role="listbox"
      aria-label="Slash commands"
    >
      {commands.map((command, index) => (
        <button
          key={command.id}
          type="button"
          className={`slash-command-item ${index === selectedIndex ? 'selected' : ''}`}
          onClick={() => onSelect(command)}
          role="option"
          aria-selected={index === selectedIndex}
        >
          <div className="slash-command-label">{command.label}</div>
          <div className="slash-command-description">{command.description}</div>
        </button>
      ))}
    </div>
  );
}
