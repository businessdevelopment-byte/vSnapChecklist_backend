import { Request, Response } from "express";
import { misService } from "../services/mis/mis.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  misDashboardQuerySchema,
  misHistoryQuerySchema,
  setMisTargetSchema,
  submitMisPlansSchema,
  setMisImagesSchema,
} from "../schemas/mis.schemas";
import { getCurrentWeekBounds, getWeekBounds } from "../utils/misWeek";

// Staff may only edit their own row, and only the one week that is open for
// them: next week's plan (commitment) or this week's image. Admins: anyone,
// any week. Returns an error message, or null when allowed.
function ownRowViolation(
  req: Request,
  items: { userId: number; weekStart: string }[],
  allowedWeek: "current" | "next"
): string | null {
  if (req.user!.role === "ADMIN") return null;
  const current = getCurrentWeekBounds().weekStart;
  const allowed = new Date(current);
  if (allowedWeek === "next") allowed.setUTCDate(allowed.getUTCDate() + 7);
  for (const item of items) {
    if (item.userId !== req.user!.userId) return "You can only update your own MIS row";
    if (getWeekBounds(new Date(item.weekStart)).weekStart.getTime() !== allowed.getTime()) {
      return allowedWeek === "next" ? "Commitments can only be set for next week" : "Images can only be added for the current week";
    }
  }
  return null;
}

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
      const input = submitMisPlansSchema.parse(req.body);
      const violation = ownRowViolation(req, input.items, "next");
      if (violation) { sendError(res, violation, 403); return; }
      const result = await misService.submitPlans({ items: input.items, setByUserId: req.user!.userId });
      sendSuccess(res, result, "Plans saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save plans", e.status ?? 400);
    }
  },

  async setImages(req: Request, res: Response): Promise<void> {
    try {
      const input = setMisImagesSchema.parse(req.body);
      const violation = ownRowViolation(req, input.items, "current");
      if (violation) { sendError(res, violation, 403); return; }
      const result = await misService.setImages({ items: input.items, setByUserId: req.user!.userId });
      sendSuccess(res, result, "Image saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save image", e.status ?? 400);
    }
  },
};
