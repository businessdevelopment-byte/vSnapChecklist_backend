import type { Request, Response, CookieOptions } from "express";
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
// site boundary there. In production the frontend (cl.vsnapu.com, Vercel)
// calls this API (botivateapi.vsnapu.com) cross-origin, and prod's
// COOKIE_DOMAIN is ".botivateapi.vsnapu.com" — the cookies live on the API
// host only, which is all that's needed: only this backend reads them (the
// frontend has no server-side middleware). SameSite=Lax still lets them ride
// along because sibling subdomains are "same-site". Widening COOKIE_DOMAIN to
// ".vsnapu.com" would also send the tokens to every other *.vsnapu.com site.
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

// Before COOKIE_DOMAIN existed (2026-08-01) prod set host-only cookies, and a
// browser keeps those alongside the domain ones under the same name — sending
// both, older first, so cookie-parser reads the stale token and the session
// fails right after a successful login. A clear without a domain removes only
// that host-only copy.
function clearLegacyHostOnlyCookies(res: Response): void {
  if (!env.COOKIE_DOMAIN) return;
  res.clearCookie("refreshToken", { path: "/" });
  res.clearCookie("accessToken", { path: "/" });
}

export function setAuthCookies(res: Response, refreshToken: string, accessToken: string): void {
  clearLegacyHostOnlyCookies(res);
  res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTS);
  res.cookie("accessToken", accessToken, ACCESS_COOKIE_OPTS);
}

// Also used whenever a session turns out to be dead (failed refresh, deleted
// or deactivated user) — no point leaving a token the browser will keep
// sending on every request only to be rejected.
export function clearAuthCookies(res: Response): void {
  clearLegacyHostOnlyCookies(res);
  res.clearCookie("refreshToken", CLEAR_COOKIE_OPTS);
  res.clearCookie("accessToken", CLEAR_COOKIE_OPTS);
}

// Every value the browser sent under this cookie name, in header order. The
// API shares vsnapu.com with ~30 other sites on the prod IIS server, and any
// of them can set an "accessToken"/"refreshToken" cookie on .vsnapu.com. The
// browser sends that one alongside ours — older cookies first — and
// cookie-parser's req.cookies keeps only the first, so a fresh login was read
// as the other site's token and 401'd. Callers try each value instead.
export function readCookieValues(req: Request, name: string): string[] {
  const header = req.headers.cookie;
  if (!header) return [];

  const values: string[] = [];
  for (const pair of header.split(";")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1 || pair.slice(0, eqIdx).trim() !== name) continue;
    let value = pair.slice(eqIdx + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (!value) continue;
    try {
      values.push(decodeURIComponent(value));
    } catch {
      values.push(value);
    }
  }
  return values;
}
