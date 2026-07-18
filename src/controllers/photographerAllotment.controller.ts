import { Request, Response } from "express";
import { photographerAllotmentService } from "../services/photographerAllotment.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { photographerAllotmentDateRangeSchema } from "../schemas/photographerAllotment.schemas";

export const photographerAllotmentController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = photographerAllotmentDateRangeSchema.parse(req.query);
      const data = await photographerAllotmentService.fetchCreatedBetween(fromDate, toDate);
      sendSuccess(res, data, "Photographer allotments fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch photographer allotments", e.status ?? 500);
    }
  },

  async apply(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = photographerAllotmentDateRangeSchema.parse(req.body);
      const result = await photographerAllotmentService.applyCreatedBetween(fromDate, toDate, req.user!.userId);
      sendSuccess(res, result, "Photographer allotments applied");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to apply photographer allotments", e.status ?? 500);
    }
  },
};
