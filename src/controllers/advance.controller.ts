import { Request, Response } from "express";
import { advanceService } from "../services/advance.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { advanceDateRangeSchema } from "../schemas/advance.schemas";

export const advanceController = {
  async summary(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = advanceDateRangeSchema.parse(req.query);
      const data = await advanceService.getSummary(fromDate, toDate);
      sendSuccess(res, data, "Advance summary fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch advance summary", e.status ?? 500);
    }
  },
};
