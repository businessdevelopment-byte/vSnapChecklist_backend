import { Request, Response } from "express";
import { monthlyAttendanceService } from "../services/monthlyAttendance.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  monthlyAttendanceQuerySchema,
  createMonthlyAttendanceSchema,
} from "../schemas/monthlyAttendance.schemas";

export const monthlyAttendanceController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = monthlyAttendanceQuerySchema.parse(req.query);
      const result = await monthlyAttendanceService.list(query);
      sendPaginated(res, result, "Monthly attendance fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch monthly attendance", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createMonthlyAttendanceSchema.parse(req.body);
      const record = await monthlyAttendanceService.create(input);
      sendSuccess(res, record, "Monthly attendance recorded", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to record monthly attendance", e.status ?? 400);
    }
  },
};
