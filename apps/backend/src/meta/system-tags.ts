export const SYSTEM_TAGS = [
  {
    name: 'auto-prune',
    color: '#8E7CC3',
  },
] as const;

export const AUTO_PRUNE_TAG_NAME = SYSTEM_TAGS[0].name;

function normalizeSystemTagName(name: string): string {
  return name.trim().toLowerCase();
}

const SYSTEM_TAG_NAMES: ReadonlySet<string> = new Set(
  SYSTEM_TAGS.map((tag) => normalizeSystemTagName(tag.name)),
);

export function isSystemTagName(name: string): boolean {
  return SYSTEM_TAG_NAMES.has(normalizeSystemTagName(name));
}
