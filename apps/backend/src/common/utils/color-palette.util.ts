/**
 * Predefined color palette for tags
 * Colors are chosen to be visually distinct and accessible
 */
const TAG_COLOR_PALETTE = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#FFA07A', // Light Salmon
  '#98D8C8', // Mint
  '#F7DC6F', // Yellow
  '#BB8FCE', // Purple
  '#85C1E2', // Sky Blue
  '#F8B739', // Orange
  '#52B788', // Green
  '#E76F51', // Coral
  '#8E7CC3', // Lavender
  '#FF9FF3', // Pink
  '#54A0FF', // Bright Blue
  '#48DBFB', // Cyan
  '#1DD1A1', // Emerald
  '#FFA502', // Amber
  '#FF6348', // Tomato
  '#5F27CD', // Deep Purple
  '#00D2D3', // Turquoise
];

/**
 * Returns a random color from the predefined palette
 */
export function getRandomTagColor(): string {
  const randomIndex = Math.floor(Math.random() * TAG_COLOR_PALETTE.length);
  return TAG_COLOR_PALETTE[randomIndex];
}
