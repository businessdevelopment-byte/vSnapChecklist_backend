import { Request, Response } from "express";
import { editorAllotmentService } from "../services/editorAllotment.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { editorAllotmentDateRangeSchema } from "../schemas/editorAllotment.schemas";

export const editorAllotmentController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { fromDate, toDate } = editorAllotmentDateRangeSchema.parse(req.query);
      const data = await editorAllotmentService.fetchCreatedBetween(fromDate, toDate);
      sendSuccess(res, data, "Editor allotments fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch editor allotments", e.status ?? 500);
    }
  },
};
