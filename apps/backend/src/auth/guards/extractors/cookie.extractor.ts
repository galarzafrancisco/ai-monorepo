/*
Dumb helper that extracts the auth token from a cookie
*/

import { Request } from "express";
import { COOKIE_KEYS } from "../../core/constants";

export function extractTokenFromCookie(req: Request): string | null {
  const token = req.cookies?.[COOKIE_KEYS.ACCESS_TOKEN] || '';

  return token.length > 0 ? token : null;
}