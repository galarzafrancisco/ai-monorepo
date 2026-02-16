import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';

export interface Command {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  onSelect: () => void;
}

interface CommandPaletteContextValue {
  commands: Command[];
  registerCommands: (commands: Command[]) => () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function useCommandPalette() {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [registeredMap, setRegisteredMap] = useState<Map<string, Command[]>>(new Map());
  const keyCounter = useRef(0);

  const globalCommands: Command[] = useMemo(() => [
    {
      id: 'nav-tasks',
      label: 'Tasks',
      description: 'Go to tasks',
      aliases: ['task'],
      onSelect: () => navigate('/tasks'),
    },
    {
      id: 'nav-context',
      label: 'Context',
      description: 'Go to context blocks',
      aliases: ['blocks', 'block'],
      onSelect: () => navigate('/context'),
    },
    {
      id: 'nav-agents',
      label: 'Agents',
      description: 'Go to agents',
      aliases: ['agent'],
      onSelect: () => navigate('/agents'),
    },
    {
      id: 'nav-threads',
      label: 'Threads',
      description: 'Go to threads',
      aliases: ['thread'],
      onSelect: () => navigate('/threads'),
    },
    {
      id: 'nav-tools',
      label: 'Tools',
      description: 'Go to tools',
      aliases: ['mcp', 'tool'],
      onSelect: () => navigate('/tools'),
    },
    {
      id: 'nav-schedule',
      label: 'Schedule',
      description: 'Go to schedule',
      aliases: ['cron', 'schedules'],
      onSelect: () => navigate('/tasks/schedule'),
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      description: 'Go to settings',
      aliases: ['setting', 'config'],
      onSelect: () => navigate('/settings'),
    },
    {
      id: 'new-task',
      label: 'New Task',
      description: 'Create a new task',
      aliases: ['create', 'add task'],
      onSelect: () => navigate('/tasks?new=1'),
    },
  ], [navigate]);

  const registerCommands = useCallback((commands: Command[]) => {
    const key = String(++keyCounter.current);
    setRegisteredMap(prev => {
      const next = new Map(prev);
      next.set(key, commands);
      return next;
    });
    return () => {
      setRegisteredMap(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    };
  }, []);

  const commands = useMemo(() => {
    const pageCommands = Array.from(registeredMap.values()).flat();
    return [...pageCommands, ...globalCommands];
  }, [globalCommands, registeredMap]);

  const value = useMemo(() => ({ commands, registerCommands }), [commands, registerCommands]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  );
}
