import { Response } from "express";
import type { Request } from "express";
import { authService } from "../services/auth.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { loginSchema, registerSchema } from "../schemas/auth.schemas";
import { REFRESH_COOKIE_OPTS, ACCESS_COOKIE_OPTS, clearAuthCookies } from "../utils/authCookies";

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
      // The session is dead (revoked, expired, user deleted or inactive) —
      // drop the cookies so the browser lands on /login instead of looping.
      clearAuthCookies(res);
      sendError(res, error.message ?? "Token refresh failed", error.status ?? 401);
    }
  },

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken;
      await authService.logout(refreshToken);
      clearAuthCookies(res);
      sendSuccess(res, null, "Logged out successfully");
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      sendError(res, error.message ?? "Logout failed", error.status ?? 400);
    }
  },
};
