import { Request, Response } from "express";
import { payrollService } from "../services/payroll.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { payrollQuerySchema, createPayrollEntrySchema, mySalaryQuerySchema } from "../schemas/payroll.schemas";

export const payrollController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = payrollQuerySchema.parse(req.query);
      const result = await payrollService.list(query);
      sendPaginated(res, result, "Payroll entries fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch payroll entries", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createPayrollEntrySchema.parse(req.body);
      const entry = await payrollService.create(input);
      sendSuccess(res, entry, "Payroll entry saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save payroll entry", e.status ?? 400);
    }
  },

  async mySalary(req: Request, res: Response): Promise<void> {
    try {
      const query = mySalaryQuerySchema.parse(req.query);
      const result = await payrollService.getForCurrentUser(req.user!.userId, query);
      sendSuccess(res, result, "My salary fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch my salary", e.status ?? 500);
    }
  },
};
