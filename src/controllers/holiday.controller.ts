import { Request, Response } from "express";
import { holidayService } from "../services/holiday.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { z } from "zod";

const createSchema = z.object({
  date: z.string().min(8),
  name: z.string().min(1).max(100),
});

const workingDaySchema = z.object({
  fromDate: z.string().min(8),
  toDate:   z.string().min(8),
  skipSundays: z.coerce.boolean().default(true),
});

export const holidayController = {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const holidays = await holidayService.getAll();
      sendSuccess(res, holidays, "Holidays fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const { date, name } = createSchema.parse(req.body);
      const holiday = await holidayService.create(date, name);
      sendSuccess(res, holiday, "Holiday added", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed", e.status ?? 400);
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const result = await holidayService.remove(Number(req.params.id));
      sendSuccess(res, result, "Holiday removed");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed", e.status ?? 400);
    }
  },

  async getWorkingDays(req: Request, res: Response): Promise<void> {
    try {
      const query = workingDaySchema.parse(req.query);
      const result = await holidayService.getWorkingDays(query.fromDate, query.toDate, query.skipSundays);
      sendSuccess(res, result, "Working days calculated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed", e.status ?? 400);
    }
  },
};
