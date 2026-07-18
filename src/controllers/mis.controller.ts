import { Request, Response } from "express";
import { misService } from "../services/mis/mis.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  misDashboardQuerySchema,
  misHistoryQuerySchema,
  setMisTargetSchema,
  submitMisPlansSchema,
} from "../schemas/mis.schemas";

export const misController = {
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const query = misDashboardQuerySchema.parse(req.query);
      // Non-admins never see another user's data, regardless of what's in the query string.
      const userId = req.user!.role === "ADMIN" ? query.userId : req.user!.userId;
      const data = await misService.getDashboard({ systemKey: query.systemKey, weekStart: query.weekStart, userId });
      sendSuccess(res, data, "MIS dashboard fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch MIS dashboard", e.status ?? 500);
    }
  },

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = misHistoryQuerySchema.parse(req.query);
      const userId = req.user!.role === "ADMIN" ? query.userId : req.user!.userId;
      const result = await misService.getHistory({ ...query, userId });
      sendPaginated(res, result, "MIS history fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch MIS history", e.status ?? 500);
    }
  },

  async setTarget(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const input = setMisTargetSchema.parse(req.body);
      const target = await misService.setTarget({ ...input, setByUserId: req.user!.userId });
      sendSuccess(res, target, "Target saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save target", e.status ?? 400);
    }
  },

  async submitPlans(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const input = submitMisPlansSchema.parse(req.body);
      const result = await misService.submitPlans({ items: input.items, setByUserId: req.user!.userId });
      sendSuccess(res, result, "Plans saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save plans", e.status ?? 400);
    }
  },
};
