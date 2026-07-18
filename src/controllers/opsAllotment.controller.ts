import { Request, Response } from "express";
import { opsAllotmentService } from "../services/opsAllotment.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { opsAllotmentDateRangeSchema } from "../schemas/opsAllotment.schemas";

export const opsAllotmentController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = opsAllotmentDateRangeSchema.parse(req.query);
      const data = await opsAllotmentService.fetchCreatedBetween(fromDate, toDate);
      sendSuccess(res, data, "Ops allotments fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch ops allotments", e.status ?? 500);
    }
  },

  async apply(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = opsAllotmentDateRangeSchema.parse(req.body);
      const result = await opsAllotmentService.applyCreatedBetween(fromDate, toDate);
      sendSuccess(res, result, "Ops allotments applied");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to apply ops allotments", e.status ?? 500);
    }
  },
};
