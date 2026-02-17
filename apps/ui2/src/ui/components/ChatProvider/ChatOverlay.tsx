import { useEffect, useState, useRef } from 'react';
import { useCommandPalette } from './CommandPaletteProvider';
import type { Command } from './CommandPaletteProvider';
import './CommandPalette.css';

export function CommandPalette() {
  const { commands } = useCommandPalette();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Calculate match score for a command
  // Higher score = better match
  function calculateMatchScore(cmd: Command, searchTerm: string): number {
    const labelLower = cmd.label.toLowerCase();
    const descLower = cmd.description?.toLowerCase() || '';

    // Check label match
    const labelIndex = labelLower.indexOf(searchTerm);
    if (labelIndex !== -1) {
      // Exact match gets highest score
      if (labelLower === searchTerm) return 1000;
      // Start of label match gets high score
      if (labelIndex === 0) return 500;
      // Middle of label match
      return 300;
    }

    // Check alias matches
    if (cmd.aliases) {
      for (const alias of cmd.aliases) {
        const aliasLower = alias.toLowerCase();
        const aliasIndex = aliasLower.indexOf(searchTerm);
        if (aliasIndex !== -1) {
          // Exact alias match
          if (aliasLower === searchTerm) return 800;
          // Start of alias match
          if (aliasIndex === 0) return 400;
          // Middle of alias match
          return 200;
        }
      }
    }

    // Check description match (lowest priority)
    if (descLower.includes(searchTerm)) {
      return 100;
    }

    return 0;
  }

  // Fuzzy search/filter commands with scoring
  const searchTerm = input.toLowerCase().trim();
  const filteredCommands = commands
    .map((cmd) => ({
      command: cmd,
      score: searchTerm ? calculateMatchScore(cmd, searchTerm) : 0,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      // Sort by score descending
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // If scores are equal, maintain original order
      return 0;
    })
    .map((item) => item.command);

  function highlightMatch(text: string): React.ReactNode {
    if (!searchTerm) return text;
    const idx = text.toLowerCase().indexOf(searchTerm);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark>{text.slice(idx, idx + searchTerm.length)}</mark>
        {text.slice(idx + searchTerm.length)}
      </>
    );
  }

  // Reset selected index when filtered commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [input]);

  // Global keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+/ on Mac or CTRL+/ on Windows/Linux
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node) && isOpen) {
        closeAndReset();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  function closeAndReset() {
    setIsOpen(false);
    setInput('');
    setSelectedIndex(0);
  }

  function executeCommand(command: Command) {
    command.onSelect();
    closeAndReset();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAndReset();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : prev
      );
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (filteredCommands.length === 0) {
        // Trigger shake animation
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      const selectedCommand = filteredCommands[selectedIndex];
      if (selectedCommand) {
        executeCommand(selectedCommand);
      }
      return;
    }
  }

  if (!isOpen) return null;

  return (
    <div className="command-palette-backdrop">
      <div
        className={`command-palette-container ${shake ? 'command-palette-container--shake' : ''}`}
        ref={overlayRef}
      >
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder="Type a command..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />

        {filteredCommands.length > 0 && (
          <div className="command-palette-results">
            {filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                className={`command-palette-item ${
                  index === selectedIndex ? 'command-palette-item--selected' : ''
                }`}
                onClick={() => executeCommand(cmd)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="command-palette-item-label">{highlightMatch(cmd.label)}</span>
                {cmd.description && (
                  <span className="command-palette-item-description">{cmd.description}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {input && filteredCommands.length === 0 && (
          <div className="command-palette-no-results">
            No commands found
          </div>
        )}
      </div>
    </div>
  );
}
