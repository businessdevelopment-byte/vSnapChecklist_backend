import { Request, Response } from "express";
import { editedDataQcService } from "../services/editedDataQc.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { editedDataQcDateRangeSchema } from "../schemas/editedDataQc.schemas";

export const editedDataQcController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = editedDataQcDateRangeSchema.parse(req.query);
      const data = await editedDataQcService.fetchCreatedBetween(fromDate, toDate);
      sendSuccess(res, data, "Edited data QC fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch edited data QC", e.status ?? 500);
    }
  },
};
