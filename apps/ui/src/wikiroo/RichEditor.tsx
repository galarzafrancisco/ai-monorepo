import { useState, useRef, KeyboardEvent } from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { SlashCommandMenu } from './SlashCommandMenu';
import type { SlashCommand } from './types';
import { createAllSlashCommands } from './slashCommands';
import './Wikiroo.css';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

interface CommandMenuState {
  active: boolean;
  query: string;
  position: { x: number; y: number };
  selectedIndex: number;
  startPosition: number;
}

export function RichEditor({ value, onChange, placeholder, disabled }: RichEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [commandMenu, setCommandMenu] = useState<CommandMenuState>({
    active: false,
    query: '',
    position: { x: 0, y: 0 },
    selectedIndex: 0,
    startPosition: 0,
  });

  const insertText = (before: string, after: string = '') => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = commandMenu.startPosition;
    const end = textarea.selectionEnd;

    // Remove the slash command text
    const beforeSlash = value.substring(0, start);
    const afterCommand = value.substring(end);

    // Insert the new text
    const newValue = beforeSlash + before + after + afterCommand;
    onChange(newValue);

    // Close command menu
    setCommandMenu({ ...commandMenu, active: false });

    // Set cursor position
    setTimeout(() => {
      const cursorPos = start + before.length;
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  // Define available slash commands using the registry
  const allCommands: SlashCommand[] = createAllSlashCommands(insertText);

  // Filter commands based on query
  const filteredCommands = commandMenu.query
    ? allCommands.filter((cmd) =>
        cmd.label.toLowerCase().includes(commandMenu.query.toLowerCase())
      )
    : allCommands;

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!commandMenu.active) {
      // Detect "/" to open menu
      if (e.key === '/') {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const cursorPos = textarea.selectionStart;
        const beforeCursor = value.substring(0, cursorPos);

        // Only trigger if "/" is at start of line or after whitespace
        if (cursorPos === 0 || beforeCursor[cursorPos - 1].match(/\s/)) {
          // Calculate position for menu
          const rect = textarea.getBoundingClientRect();
          const lineHeight = 24; // Approximate line height
          const lines = beforeCursor.split('\n').length;

          setCommandMenu({
            active: true,
            query: '',
            position: {
              x: rect.left + 16,
              y: rect.top + lines * lineHeight + 40,
            },
            selectedIndex: 0,
            startPosition: cursorPos,
          });
        }
      }
      return;
    }

    // Handle keyboard navigation when menu is active
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setCommandMenu({ ...commandMenu, active: false });
        break;

      case 'ArrowDown':
        e.preventDefault();
        setCommandMenu({
          ...commandMenu,
          selectedIndex: (commandMenu.selectedIndex + 1) % filteredCommands.length,
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setCommandMenu({
          ...commandMenu,
          selectedIndex:
            commandMenu.selectedIndex === 0
              ? filteredCommands.length - 1
              : commandMenu.selectedIndex - 1,
        });
        break;

      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (filteredCommands[commandMenu.selectedIndex]) {
          filteredCommands[commandMenu.selectedIndex].action();
        }
        break;

      case 'Backspace':
        // Close menu if we delete back to the slash
        const textarea = textareaRef.current;
        if (textarea && textarea.selectionStart <= commandMenu.startPosition) {
          setCommandMenu({ ...commandMenu, active: false });
        }
        break;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Update query if command menu is active
    if (commandMenu.active && textareaRef.current) {
      const cursorPos = textareaRef.current.selectionStart;
      const query = newValue.substring(commandMenu.startPosition + 1, cursorPos);

      setCommandMenu({
        ...commandMenu,
        query,
        selectedIndex: 0,
      });
    }
  };

  const handleCommandSelect = (command: SlashCommand) => {
    command.action();
  };

  const handleCommandCancel = () => {
    setCommandMenu({ ...commandMenu, active: false });
  };

  return (
    <div className="rich-editor">
      <div className="rich-editor-panes">
        <div className="rich-editor-pane rich-editor-edit">
          <div className="rich-editor-label">Edit</div>
          <textarea
            ref={textareaRef}
            className="rich-editor-textarea"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Write in markdown...'}
            disabled={disabled}
            aria-label="Markdown editor"
          />
          {commandMenu.active && (
            <SlashCommandMenu
              commands={filteredCommands}
              selectedIndex={commandMenu.selectedIndex}
              position={commandMenu.position}
              onSelect={handleCommandSelect}
              onCancel={handleCommandCancel}
            />
          )}
        </div>

        <div className="rich-editor-pane rich-editor-preview">
          <div className="rich-editor-label">Preview</div>
          <div className="rich-editor-preview-content">
            {value ? (
              <MarkdownPreview content={value} />
            ) : (
              <div className="rich-editor-empty">Nothing to preview yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
