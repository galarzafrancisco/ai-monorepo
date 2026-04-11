import type { CSSProperties } from "react";
import "./Avatar.css";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | number;

export interface AvatarProps {
  name: string;
  src?: string;
  alt?: string;
  size?: AvatarSize;
  className?: string;
}

const PALETTE = [
  "a1", // blue
  "a2", // green
  "a3", // purple
  "a4", // orange
  "a5", // pink
  "a6", // teal
] as const;

function hashString(input: string): number {
  // simple, fast, deterministic (djb2-like)
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  return h >>> 0; // unsigned
}

function pickColorToken(name: string | undefined): (typeof PALETTE)[number] {
  if (!name) return PALETTE[0];
  const idx = hashString(name.trim().toLowerCase()) % PALETTE.length;
  return PALETTE[idx];
}

function getInitials(name: string | undefined): string {
  if (!name) return "?";
  const cleaned = name.trim();
  if (!cleaned) return "?";

  // handle "First Last" -> FL, "Madonna" -> M, "first last third" -> FL
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";

  return (first + last).toUpperCase();
}

function sizeToClass(size: AvatarSize): string | null {
  if (typeof size === "number") return null;
  return `avatar--${size}`;
}

function sizeToStyle(size: AvatarSize): CSSProperties | undefined {
  if (typeof size !== "number") return undefined;
  return { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.42))};
}

export function Avatar({
  name,
  src,
  alt,
  size = "md",
  className = "",
}: AvatarProps) {
  const initials = getInitials(name);
  const color = pickColorToken(name);
  const sizeClass = sizeToClass(size);
  const style = sizeToStyle(size);

  if (src) {
    return (
      <img
        className={`avatar ${sizeClass ?? ""} ${className}`}
        style={style}
        src={src}
        alt={alt ?? name}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`avatar avatar--fallback avatar--${color} ${sizeClass ?? ""} ${className}`}
      style={style}
      aria-label={alt ?? name}
      role="img"
      title={name}
    >
      {initials}
    </div>
  );
}
