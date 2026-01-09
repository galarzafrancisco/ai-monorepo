
/*
Dumb helper that extracts the Bearer auth header from a request.
*/

import { Request } from "express";

export function extractBearerToken(req: Request): string | null {
  const raw = req.headers["authorization"];
  if (typeof raw !== "string" || raw.length === 0) return null;

  // Accept exactly "Bearer <token>" (case-insensitive on scheme).
  const [scheme, ...rest] = raw.split(" ");
  if (!scheme || rest.length === 0) return null;
  if (scheme.toLowerCase() !== "bearer") return null;

  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}