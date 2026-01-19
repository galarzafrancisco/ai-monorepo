import type { SlashCommand } from './types';

/**
 * Slash command definition with markdown template
 */
export interface SlashCommandDefinition {
  id: string;
  label: string;
  trigger: string;
  markdown: {
    before: string;
    after?: string;
  };
  description: string;
  icon?: string;
}

/**
 * Registry of all available slash commands
 */
export const SLASH_COMMAND_DEFINITIONS: SlashCommandDefinition[] = [
  {
    id: 'h1',
    label: '/h1',
    trigger: 'h1',
    markdown: { before: '# ' },
    description: 'Heading 1',
  },
  {
    id: 'h2',
    label: '/h2',
    trigger: 'h2',
    markdown: { before: '## ' },
    description: 'Heading 2',
  },
  {
    id: 'h3',
    label: '/h3',
    trigger: 'h3',
    markdown: { before: '### ' },
    description: 'Heading 3',
  },
  {
    id: 'h4',
    label: '/h4',
    trigger: 'h4',
    markdown: { before: '#### ' },
    description: 'Heading 4',
  },
  {
    id: 'h5',
    label: '/h5',
    trigger: 'h5',
    markdown: { before: '##### ' },
    description: 'Heading 5',
  },
  {
    id: 'h6',
    label: '/h6',
    trigger: 'h6',
    markdown: { before: '###### ' },
    description: 'Heading 6',
  },
  {
    id: 'bold',
    label: '/bold',
    trigger: 'bold',
    markdown: { before: '**', after: '**' },
    description: 'Bold text',
  },
  {
    id: 'italic',
    label: '/italic',
    trigger: 'italic',
    markdown: { before: '_', after: '_' },
    description: 'Italic text',
  },
  {
    id: 'code',
    label: '/code',
    trigger: 'code',
    markdown: { before: '`', after: '`' },
    description: 'Inline code',
  },
  {
    id: 'codeblock',
    label: '/codeblock',
    trigger: 'codeblock',
    markdown: { before: '```\n', after: '\n```' },
    description: 'Code block',
  },
  {
    id: 'table',
    label: '/table',
    trigger: 'table',
    markdown: { before: '| Column 1 | Column 2 |\n| --- | --- |\n| | |' },
    description: 'Insert table',
  },
  {
    id: 'list',
    label: '/list',
    trigger: 'list',
    markdown: { before: '- ' },
    description: 'Bullet list',
  },
  {
    id: 'numbered',
    label: '/numbered',
    trigger: 'numbered',
    markdown: { before: '1. ' },
    description: 'Numbered list',
  },
  {
    id: 'quote',
    label: '/quote',
    trigger: 'quote',
    markdown: { before: '> ' },
    description: 'Block quote',
  },
  {
    id: 'divider',
    label: '/divider',
    trigger: 'div',
    markdown: { before: '\n---\n' },
    description: 'Horizontal divider',
  },
  {
    id: 'link',
    label: '/link',
    trigger: 'link',
    markdown: { before: '[', after: '](url)' },
    description: 'Insert link',
  },
];

/**
 * Filter commands based on a search query
 * @param query - The search string to filter by
 * @returns Filtered array of command definitions
 */
export function filterCommands(query: string): SlashCommandDefinition[] {
  if (!query) {
    return SLASH_COMMAND_DEFINITIONS;
  }

  const lowerQuery = query.toLowerCase();
  return SLASH_COMMAND_DEFINITIONS.filter(
    (cmd) =>
      cmd.trigger.toLowerCase().includes(lowerQuery) ||
      cmd.label.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Create a SlashCommand with action from a definition
 * @param definition - The command definition
 * @param insertText - Function to insert text at cursor position
 * @returns A SlashCommand ready to use in the editor
 */
export function createSlashCommand(
  definition: SlashCommandDefinition,
  insertText: (before: string, after?: string) => void
): SlashCommand {
  return {
    id: definition.id,
    label: definition.label,
    description: definition.description,
    action: () => insertText(definition.markdown.before, definition.markdown.after),
  };
}

/**
 * Create all slash commands from definitions
 * @param insertText - Function to insert text at cursor position
 * @returns Array of SlashCommands ready to use in the editor
 */
export function createAllSlashCommands(
  insertText: (before: string, after?: string) => void
): SlashCommand[] {
  return SLASH_COMMAND_DEFINITIONS.map((def) => createSlashCommand(def, insertText));
}
