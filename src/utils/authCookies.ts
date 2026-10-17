import type { Response, CookieOptions } from "express";
import { env } from "../config/env";

// Parses simple "15m" / "1h" / "7d" style durations (the only suffixes this
// codebase's JWT_ACCESS_EXPIRES_IN values ever use) into milliseconds for
// the access-token cookie's maxAge.
function parseDurationToMs(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) return 15 * 60 * 1000; // fallback: 15 minutes
  const value = Number(match[1]);
  const unitMs: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  return value * unitMs[match[2]];
}

// Locally, frontend and backend are same-origin (Next.js proxies /api/* to
// this backend via next.config.ts's rewrites()), so cookies never cross a
// site boundary there. In production, frontend and backend are deployed on
// different subdomains of the same site (e.g. cl.vsnapu.com / botivateapi.vsnapu.com)
// — COOKIE_DOMAIN (".vsnapu.com") makes the cookie valid for both, and
// SameSite=Lax still applies because sibling subdomains are "same-site".
export const REFRESH_COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  domain: env.COOKIE_DOMAIN,
  maxAge: env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
};

export const ACCESS_COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  domain: env.COOKIE_DOMAIN,
  maxAge: parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN),
};

// clearCookie must be called with the same domain/path the cookie was set
// with, or the browser won't recognize it as the same cookie to remove.
const CLEAR_COOKIE_OPTS: CookieOptions = { path: "/", domain: env.COOKIE_DOMAIN };

// Also used whenever a session turns out to be dead (failed refresh, deleted
// or deactivated user) — frontend middleware.ts treats a lingering
// refreshToken cookie as "logged in" and would bounce /login back to the
// dashboard forever.
export function clearAuthCookies(res: Response): void {
  res.clearCookie("refreshToken", CLEAR_COOKIE_OPTS);
  res.clearCookie("accessToken", CLEAR_COOKIE_OPTS);
}
