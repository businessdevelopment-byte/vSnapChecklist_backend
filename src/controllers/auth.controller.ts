import { Response, CookieOptions } from "express";
import type { Request } from "express";
import { authService } from "../services/auth.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { loginSchema, registerSchema } from "../schemas/auth.schemas";
import { env } from "../config/env";

const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: env.NODE_ENV === "production" ? "none" : "lax",
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000,
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
      res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
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
      res.cookie("refreshToken", refreshToken, COOKIE_OPTS);
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
      res.cookie("refreshToken", newRefreshToken, COOKIE_OPTS);
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
      res.clearCookie("refreshToken", { path: "/api/auth" });
      sendSuccess(res, null, "Logged out successfully");
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      sendError(res, error.message ?? "Logout failed", error.status ?? 400);
    }
  },
};
