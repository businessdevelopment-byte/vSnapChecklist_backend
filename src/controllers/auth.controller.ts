import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { loginSchema, registerSchema } from "../schemas/auth.schemas";

export const authController = {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const input = loginSchema.parse(req.body);
      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        ?? req.socket.remoteAddress
        ?? undefined;

      const result = await authService.login(input, ip);
      sendSuccess(res, result, "Login successful");
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      sendError(res, error.message ?? "Login failed", error.status ?? 400);
    }
  },

  async register(req: Request, res: Response): Promise<void> {
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.register(input);
      sendSuccess(res, result, "Account created successfully", 201);
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      sendError(res, error.message ?? "Registration failed", error.status ?? 400);
    }
  },

  async logout(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, null, "Logged out successfully");
  },
};
