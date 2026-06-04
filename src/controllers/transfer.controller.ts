import { Request, Response } from "express";
import { transferService } from "../services/transfer.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { transferTasksSchema } from "../schemas/transfer.schemas";

export const transferController = {
  async transferTasks(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Only admin can transfer tasks", 403);
        return;
      }
      const input = transferTasksSchema.parse(req.body);
      const result = await transferService.transferTasks(input, req.user!.userId);
      sendSuccess(res, result, `${result.transferred} tasks transferred successfully`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to transfer tasks", e.status ?? 400);
    }
  },

  async getTransferLogs(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : req.user!.userId;
      const logs = await transferService.getTransferLogs(userId, req.user!.role, req.user!.userId);
      sendSuccess(res, logs, "Transfer logs fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch transfer logs", e.status ?? 500);
    }
  },
};
