import { Request, Response } from "express";
import { dailyAttendanceService } from "../services/dailyAttendance.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  dailyAttendanceQuerySchema,
  createDailyAttendanceSchema,
  myAttendanceQuerySchema,
} from "../schemas/dailyAttendance.schemas";

export const dailyAttendanceController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = dailyAttendanceQuerySchema.parse(req.query);
      const result = await dailyAttendanceService.list(query);
      sendPaginated(res, result, "Daily attendance fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch daily attendance", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createDailyAttendanceSchema.parse(req.body);
      const record = await dailyAttendanceService.create(input);
      sendSuccess(res, record, "Daily attendance recorded", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to record daily attendance", e.status ?? 400);
    }
  },

  async myAttendance(req: Request, res: Response): Promise<void> {
    try {
      const query = myAttendanceQuerySchema.parse(req.query);
      const result = await dailyAttendanceService.getForCurrentUser(req.user!.userId, query);
      sendSuccess(res, result, "My attendance fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch my attendance", e.status ?? 500);
    }
  },
};
