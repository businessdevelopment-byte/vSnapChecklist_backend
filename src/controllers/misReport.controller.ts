import { Request, Response } from "express";
import { misReportService } from "../services/misReport.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { misReportQuerySchema, createMisReportEntrySchema } from "../schemas/misReport.schemas";

export const misReportController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = misReportQuerySchema.parse(req.query);
      const result = await misReportService.list(query);
      sendPaginated(res, result, "MIS report entries fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch MIS report entries", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createMisReportEntrySchema.parse(req.body);
      const entry = await misReportService.create(input);
      sendSuccess(res, entry, "MIS report entry saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save MIS report entry", e.status ?? 400);
    }
  },
};
