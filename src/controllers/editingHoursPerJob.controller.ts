import { Request, Response } from "express";
import { editingHoursPerJobService } from "../services/editingHoursPerJob.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { editingHoursPerJobDateRangeSchema } from "../schemas/editingHoursPerJob.schemas";

export const editingHoursPerJobController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = editingHoursPerJobDateRangeSchema.parse(req.query);
      const data = await editingHoursPerJobService.fetchCreatedBetween(fromDate, toDate);
      sendSuccess(res, data, "Editing hours per job fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch editing hours per job", e.status ?? 500);
    }
  },
};
