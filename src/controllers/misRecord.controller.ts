import { Request, Response } from "express";
import { misRecordService } from "../services/misRecord.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  misRecordQuerySchema,
  createMisRecordSchema,
  updateMisRecordSchema,
} from "../schemas/misRecord.schemas";

export const misRecordController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = misRecordQuerySchema.parse(req.query);
      const result = await misRecordService.list(query, {
        userId: req.user!.userId,
        role: req.user!.role,
      });
      sendPaginated(res, result, "MIS records fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch MIS records", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = createMisRecordSchema.parse(req.body);
      const record = await misRecordService.create(input);
      sendSuccess(res, record, "MIS record created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create MIS record", e.status ?? 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const id = Number(req.params.id);
      const input = updateMisRecordSchema.parse(req.body);
      const record = await misRecordService.update(id, input);
      sendSuccess(res, record, "MIS record updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update MIS record", e.status ?? 400);
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const id = Number(req.params.id);
      const result = await misRecordService.remove(id);
      sendSuccess(res, result, "MIS record deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete MIS record", e.status ?? 400);
    }
  },
};
