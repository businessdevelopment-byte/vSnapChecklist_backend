import { Request, Response } from "express";
import { leaveRequestService } from "../services/leaveRequest.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  leaveRequestQuerySchema,
  leaveBalanceQuerySchema,
  createLeaveRequestSchema,
  leaveManagementQuerySchema,
  updateLeaveRequestStatusSchema,
} from "../schemas/leaveRequest.schemas";

export const leaveRequestController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = leaveRequestQuerySchema.parse(req.query);
      const result = await leaveRequestService.listByEmployee(query);
      sendPaginated(res, result, "Leave requests fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch leave requests", e.status ?? 500);
    }
  },

  async balances(req: Request, res: Response): Promise<void> {
    try {
      const query = leaveBalanceQuerySchema.parse(req.query);
      const result = await leaveRequestService.getBalances(query);
      sendSuccess(res, result, "Leave balances fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch leave balances", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createLeaveRequestSchema.parse(req.body);
      const leaveRequest = await leaveRequestService.create(input);
      sendSuccess(res, leaveRequest, "Leave request submitted", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to submit leave request", e.status ?? 400);
    }
  },

  async listAll(req: Request, res: Response): Promise<void> {
    try {
      const query = leaveManagementQuerySchema.parse(req.query);
      const result = await leaveRequestService.listAll(query);
      sendPaginated(res, result, "Leave requests fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch leave requests", e.status ?? 500);
    }
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const input = updateLeaveRequestStatusSchema.parse(req.body);
      const leaveRequest = await leaveRequestService.updateStatus(Number(req.params.id), input);
      sendSuccess(res, leaveRequest, "Leave request updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update leave request", e.status ?? 400);
    }
  },
};
