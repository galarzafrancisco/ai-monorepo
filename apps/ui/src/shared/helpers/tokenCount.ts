/** Shortens a token count for a tight spot: 423512 -> "423K", 1250000 -> "1.2M". */
export const formatTokenCount = (count: number): string => {
  if (count < 1_000) {
    return String(Math.round(count));
  }
  if (count < 1_000_000) {
    return `${Math.floor(count / 1_000)}K`;
  }
  return `${(Math.floor(count / 100_000) / 10).toFixed(1).replace(/\.0$/, '')}M`;
};
