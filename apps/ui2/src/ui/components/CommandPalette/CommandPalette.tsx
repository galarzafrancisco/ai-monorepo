import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandPalette } from './CommandPaletteProvider';
import type { Command } from './CommandPaletteProvider';
import type { TaskSearchResultDto } from '@taico/client';
import './CommandPalette.css';

// Result types that can be selected in the palette
type PaletteItem =
  | { type: 'command'; command: Command }
  | { type: 'task'; task: TaskSearchResultDto };

export function CommandPalette() {
  const { commands, searchTasks } = useCommandPalette();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [shake, setShake] = useState(false);
  const [taskResults, setTaskResults] = useState<TaskSearchResultDto[]>([]);
  const [isSearchingTasks, setIsSearchingTasks] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const requestIdRef = useRef<number>(0);

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

  // Combine commands and tasks into a single list
  // Commands come first (higher priority), then task results
  const allItems: PaletteItem[] = [
    ...filteredCommands.map((cmd): PaletteItem => ({ type: 'command', command: cmd })),
    ...taskResults.map((task): PaletteItem => ({ type: 'task', task })),
  ];

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

  // Search tasks when input changes (with debounce)
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTasks) {
      requestIdRef.current += 1;
      setTaskResults([]);
      setIsSearchingTasks(false);
      return;
    }

    // Clear task results and loading state if no input
    if (!searchTerm) {
      // Increment request ID to invalidate any in-flight requests
      requestIdRef.current += 1;
      setTaskResults([]);
      setIsSearchingTasks(false);
      return;
    }

    // Increment request ID to invalidate any pending requests
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    // Debounce task search
    searchTimeoutRef.current = window.setTimeout(async () => {
      setIsSearchingTasks(true);
      try {
        const results = await searchTasks(searchTerm);
        // Only apply results if this request is still current
        if (requestIdRef.current === currentRequestId) {
          setTaskResults(results);
        }
      } catch (err) {
        console.error('Failed to search tasks:', err);
        // Only clear results if this request is still current
        if (requestIdRef.current === currentRequestId) {
          setTaskResults([]);
        }
      } finally {
        // Only update loading state if this request is still current
        if (requestIdRef.current === currentRequestId) {
          setIsSearchingTasks(false);
        }
      }
    }, 200);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, searchTasks]);

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
    setTaskResults([]);
    setIsSearchingTasks(false);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    // Invalidate any pending async requests
    requestIdRef.current += 1;
  }

  function executeItem(item: PaletteItem) {
    if (item.type === 'command') {
      item.command.onSelect();
    } else {
      navigate(`/tasks/task/${item.task.id}`);
    }
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
        prev < allItems.length - 1 ? prev + 1 : prev
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

      if (allItems.length === 0) {
        // Trigger shake animation
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      const selectedItem = allItems[selectedIndex];
      if (selectedItem) {
        executeItem(selectedItem);
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

        {allItems.length > 0 && (
          <div className="command-palette-results">
            {allItems.map((item, index) => {
              if (item.type === 'command') {
                const cmd = item.command;
                return (
                  <div
                    key={`cmd-${cmd.id}`}
                    className={`command-palette-item ${
                      index === selectedIndex ? 'command-palette-item--selected' : ''
                    }`}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="command-palette-item-label">{highlightMatch(cmd.label)}</span>
                    {cmd.description && (
                      <span className="command-palette-item-description">{cmd.description}</span>
                    )}
                  </div>
                );
              } else {
                const task = item.task;
                return (
                  <div
                    key={`task-${task.id}`}
                    className={`command-palette-item command-palette-item--task ${
                      index === selectedIndex ? 'command-palette-item--selected' : ''
                    }`}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="command-palette-item-label">{highlightMatch(task.name)}</span>
                    <span className="command-palette-item-description">Task</span>
                  </div>
                );
              }
            })}
          </div>
        )}

        {input && allItems.length === 0 && !isSearchingTasks && (
          <div className="command-palette-no-results">
            No results found
          </div>
        )}

        {isSearchingTasks && (
          <div className="command-palette-searching">
            Searching tasks...
          </div>
        )}
      </div>
    </div>
  );
}
