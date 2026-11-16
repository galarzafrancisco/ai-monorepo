// OpenAPI tags are display labels, so punctuation must never reach identifiers.
function words(tag: string): string[] {
  return tag.split(/[^a-zA-Z0-9]+/).filter(Boolean);
}

function safeIdentifier(value: string): string {
  if (!value) return 'default';
  return /^\d/.test(value) ? `_${value}` : value;
}

export function toPascalCase(tag: string): string {
  return safeIdentifier(words(tag)
    .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(''));
}

export function toCamelCase(tag: string): string {
  const value = toPascalCase(tag);
  return value[0].toLowerCase() + value.slice(1);
}

export function toKebabCase(tag: string): string {
  return words(tag.replace(/([a-z])([A-Z])/g, '$1-$2'))
    .join('-').toLowerCase() || 'default';
}
