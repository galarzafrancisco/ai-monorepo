import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import type { TaskSearchResultDto } from '@taico/client';

export interface Command {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
  onSelect: () => void;
}

export type TaskSearchHandler = (query: string) => Promise<TaskSearchResultDto[]>;

interface CommandPaletteContextValue {
  commands: Command[];
  registerCommands: (commands: Command[]) => () => void;
  searchTasks?: TaskSearchHandler;
  registerTaskSearch: (searchHandler: TaskSearchHandler) => () => void;
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
  const [registeredTaskSearchMap, setRegisteredTaskSearchMap] = useState<Map<string, TaskSearchHandler>>(new Map());
  const keyCounter = useRef(0);

  const globalCommands: Command[] = useMemo(() => [
    {
      id: 'nav-home',
      label: 'Home',
      description: 'Go to homepage',
      aliases: ['home', 'search'],
      onSelect: () => navigate('/home'),
    },
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
      id: 'nav-runs',
      label: 'Runs',
      description: 'Go to runs',
      aliases: ['executions', 'execution', 'work queue'],
      onSelect: () => navigate('/runs'),
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

  const registerTaskSearch = useCallback((searchHandler: TaskSearchHandler) => {
    const key = String(++keyCounter.current);
    setRegisteredTaskSearchMap(prev => {
      const next = new Map(prev);
      next.set(key, searchHandler);
      return next;
    });
    return () => {
      setRegisteredTaskSearchMap(prev => {
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

  const searchTasks = useMemo(() => {
    const handlers = Array.from(registeredTaskSearchMap.values());
    return handlers[handlers.length - 1];
  }, [registeredTaskSearchMap]);

  const value = useMemo(
    () => ({ commands, registerCommands, searchTasks, registerTaskSearch }),
    [commands, registerCommands, searchTasks, registerTaskSearch],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
    </CommandPaletteContext.Provider>
  );
}
