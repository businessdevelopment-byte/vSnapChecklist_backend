import { Request, Response } from "express";
import { otpJobService } from "../services/otpJob.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { otpJobQuerySchema, createOtpJobSchema } from "../schemas/otpJob.schemas";

export const otpJobController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = otpJobQuerySchema.parse(req.query);
      const result = await otpJobService.list(query);
      sendPaginated(res, result, "Orders fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch orders", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createOtpJobSchema.parse(req.body);
      const job = await otpJobService.create(input);
      sendSuccess(res, job, "Order created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create order", e.status ?? 400);
    }
  },
};
