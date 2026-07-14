import { Request, Response } from "express";
import { rawDataQcService } from "../services/rawDataQc.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { rawDataQcDateRangeSchema } from "../schemas/rawDataQc.schemas";

export const rawDataQcController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = rawDataQcDateRangeSchema.parse(req.query);
      const data = await rawDataQcService.fetchCreatedBetween(fromDate, toDate);
      sendSuccess(res, data, "Raw data QC records fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch raw data QC records", e.status ?? 500);
    }
  },
};
