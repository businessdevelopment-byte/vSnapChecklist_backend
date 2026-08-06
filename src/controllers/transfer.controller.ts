import { Request, Response } from "express";
import { transferService } from "../services/transfer.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { transferTasksSchema, reviewRequestSchema } from "../schemas/transfer.schemas";

export const transferController = {
  async createRequest(req: Request, res: Response): Promise<void> {
    try {
      const input = transferTasksSchema.parse(req.body);
      const result = await transferService.createRequest(input, req.user!.userId, req.user!.role);
      sendSuccess(res, result, "Transfer request submitted for approval");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to submit transfer request", e.status ?? 400);
    }
  },

  async listRequests(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Only admin can view transfer requests", 403);
        return;
      }
      const status = req.query.status as "PENDING" | "APPROVED" | "REJECTED" | undefined;
      const requests = await transferService.listRequests(status);
      sendSuccess(res, requests, "Transfer requests fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch transfer requests", e.status ?? 500);
    }
  },

  async approveRequest(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Only admin can approve transfer requests", 403);
        return;
      }
      const result = await transferService.approveRequest(Number(req.params.id), req.user!.userId);
      sendSuccess(res, result, "Transfer request approved");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to approve transfer request", e.status ?? 400);
    }
  },

  async rejectRequest(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Only admin can reject transfer requests", 403);
        return;
      }
      const { reviewNote } = reviewRequestSchema.parse(req.body);
      const result = await transferService.rejectRequest(Number(req.params.id), req.user!.userId, reviewNote);
      sendSuccess(res, result, "Transfer request rejected");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to reject transfer request", e.status ?? 400);
    }
  },

  async getTransferLogs(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const logs = await transferService.getTransferLogs(userId, req.user!.role, req.user!.userId);
      sendSuccess(res, logs, "Transfer logs fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch transfer logs", e.status ?? 500);
    }
  },
};
