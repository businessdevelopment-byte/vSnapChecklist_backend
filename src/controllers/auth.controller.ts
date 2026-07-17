import { Response, CookieOptions } from "express";
import type { Request } from "express";
import { authService } from "../services/auth.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { loginSchema, registerSchema } from "../schemas/auth.schemas";
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

// The app is same-origin in every environment (browser only ever talks to
// the Next.js server, which proxies /api/* to this backend server-to-server
// via next.config.ts's rewrites()) — so cookies never need to cross a site
// boundary, and SameSite=Lax is always the right, more CSRF-resistant choice.
const REFRESH_COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
};

const ACCESS_COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: parseDurationToMs(env.JWT_ACCESS_EXPIRES_IN),
};

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        ?? req.socket.remoteAddress
        ?? undefined;
      const userAgent = req.headers["user-agent"];

      const { refreshToken, ...result } = await authService.login(input, ip, userAgent);
      res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTS);
      res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTS);
      sendSuccess(res, result, "Login successful");
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      sendError(res, error.message ?? "Login failed", error.status ?? 400);
    }
  },

  async register(req: Request, res: Response): Promise<void> {
    try {
      const input = registerSchema.parse(req.body);
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        ?? req.socket.remoteAddress
        ?? undefined;
      const userAgent = req.headers["user-agent"];

      const { refreshToken, ...result } = await authService.register(input, ip, userAgent);
      res.cookie("refreshToken", refreshToken, REFRESH_COOKIE_OPTS);
      res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTS);
      sendSuccess(res, result, "Account created successfully", 201);
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      sendError(res, error.message ?? "Registration failed", error.status ?? 400);
    }
  },

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        return sendError(res, "Refresh token missing", 401);
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        ?? req.socket.remoteAddress
        ?? undefined;
      const userAgent = req.headers["user-agent"];

      const { refreshToken: newRefreshToken, ...result } = await authService.refreshAccessToken(refreshToken, ip, userAgent);
      res.cookie("refreshToken", newRefreshToken, REFRESH_COOKIE_OPTS);
      res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTS);
      sendSuccess(res, result, "Token refreshed successfully");
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      sendError(res, error.message ?? "Token refresh failed", error.status ?? 401);
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      await authService.logout(refreshToken);
      res.clearCookie("refreshToken", { path: "/" });
      res.clearCookie("accessToken", { path: "/" });
      sendSuccess(res, null, "Logged out successfully");
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      sendError(res, error.message ?? "Logout failed", error.status ?? 400);
    }
  },
};
