import { Request, Response } from "express";
import { companyCalendarService } from "../services/companyCalendar.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createCompanyCalendarEventSchema } from "../schemas/companyCalendar.schemas";

export const companyCalendarController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const events = await companyCalendarService.list();
      sendSuccess(res, events, "Company calendar events fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch company calendar events", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createCompanyCalendarEventSchema.parse(req.body);
      const event = await companyCalendarService.create(input);
      sendSuccess(res, event, "Company calendar event created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create company calendar event", e.status ?? 400);
    }
  },
};
