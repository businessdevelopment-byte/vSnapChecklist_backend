import { Request, Response } from "express";
import { hrDashboardService } from "../services/hrDashboard.service";
import { sendSuccess, sendError } from "../utils/apiResponse";

export const hrDashboardController = {
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const result = await hrDashboardService.getSummary();
      sendSuccess(res, result, "HR dashboard summary fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch HR dashboard summary", e.status ?? 500);
    }
  },
};
