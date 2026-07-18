import { Request, Response } from "express";
import { leavingRecordService } from "../services/leavingRecord.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { leavingRecordQuerySchema, createLeavingRecordSchema } from "../schemas/leavingRecord.schemas";

export const leavingRecordController = {
  async listPending(req: Request, res: Response): Promise<void> {
    try {
      const query = leavingRecordQuerySchema.parse(req.query);
      const result = await leavingRecordService.listPending(query);
      sendPaginated(res, result, "Pending employees fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch pending employees", e.status ?? 500);
    }
  },

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = leavingRecordQuerySchema.parse(req.query);
      const result = await leavingRecordService.listHistory(query);
      sendPaginated(res, result, "Leaving records fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch leaving records", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createLeavingRecordSchema.parse(req.body);
      const leavingRecord = await leavingRecordService.create(input);
      sendSuccess(res, leavingRecord, "Leaving recorded", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to record leaving", e.status ?? 400);
    }
  },
};
