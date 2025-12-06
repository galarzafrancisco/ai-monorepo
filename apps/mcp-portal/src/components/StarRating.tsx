interface StarRatingProps {
  /** Average rating value between 0 and 5 */
  rating: number;
  /** Optional number of votes */
  votes?: number;
  /** Star emoji size (font-size in tailwind classes) */
  sizeClass?: string;
}

/**
 * Displays a 5-star bar filled proportionally to the provided rating, along with
 * the numeric rating and vote count. Purely presentational – no interactivity.
 */
export default function StarRating({
  rating,
  votes,
  sizeClass = "text-base",
}: StarRatingProps) {
  const safeRating = isFinite(rating) && rating > 0 ? rating : 0;
  const fullStars = Math.floor(safeRating);
  const hasHalfStar = safeRating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  // Helper to render a star span with the desired colour
  const Full = () => <span className={`text-yellow-400 ${sizeClass}`}>★</span>;
  const Empty = () => <span className={`text-white/20 ${sizeClass}`}>★</span>;
  // For half we just render a full star for simplicity – tweak if needed
  const Half = Full;

  return (
    <span className="inline-flex items-center gap-1">
      {/* star icons */}
      <span>
        {Array.from({ length: fullStars }).map((_, i) => (
          <Full key={`full-${i}`} />
        ))}
        {hasHalfStar && <Half key="half" />}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <Empty key={`empty-${i}`} />
        ))}
      </span>
      {/* numeric */}
      <span className="ml-2 text-sm font-semibold">
        {safeRating.toFixed(1)}
      </span>
      {/* votes */}
      {typeof votes === "number" && (
        <span className="ml-1 text-xs text-white/60">({votes})</span>
      )}
    </span>
  );
}
