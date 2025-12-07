import { useState, useRef, KeyboardEvent } from 'react';
import { MarkdownPreview } from './MarkdownPreview';
import { SlashCommandMenu } from './SlashCommandMenu';
import type { SlashCommand } from './types';
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

  // Define available slash commands
  const allCommands: SlashCommand[] = [
    {
      id: 'h1',
      label: '/h1',
      description: 'Heading 1',
      action: () => insertText('# '),
    },
    {
      id: 'h2',
      label: '/h2',
      description: 'Heading 2',
      action: () => insertText('## '),
    },
    {
      id: 'h3',
      label: '/h3',
      description: 'Heading 3',
      action: () => insertText('### '),
    },
    {
      id: 'bold',
      label: '/bold',
      description: 'Bold text',
      action: () => insertText('**', '**'),
    },
    {
      id: 'italic',
      label: '/italic',
      description: 'Italic text',
      action: () => insertText('_', '_'),
    },
    {
      id: 'code',
      label: '/code',
      description: 'Inline code',
      action: () => insertText('`', '`'),
    },
    {
      id: 'codeblock',
      label: '/codeblock',
      description: 'Code block',
      action: () => insertText('```\n', '\n```'),
    },
    {
      id: 'list',
      label: '/list',
      description: 'Bullet list',
      action: () => insertText('- '),
    },
    {
      id: 'numbered',
      label: '/numbered',
      description: 'Numbered list',
      action: () => insertText('1. '),
    },
    {
      id: 'quote',
      label: '/quote',
      description: 'Block quote',
      action: () => insertText('> '),
    },
    {
      id: 'link',
      label: '/link',
      description: 'Insert link',
      action: () => insertText('[', '](url)'),
    },
  ];

  // Filter commands based on query
  const filteredCommands = commandMenu.query
    ? allCommands.filter((cmd) =>
        cmd.label.toLowerCase().includes(commandMenu.query.toLowerCase())
      )
    : allCommands;

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
