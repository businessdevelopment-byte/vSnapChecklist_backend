import { Request, Response } from "express";
import { delegationService } from "../services/delegation.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  createDelegationSchema,
  updateDelegationStatusSchema,
  submitDelegationSchema,
  adminDoneDelegationSchema,
  reviewSubmissionSchema,
  delegationQuerySchema,
  delegationHistoryQuerySchema,
  delegationMisQuerySchema,
  importDelegationsSchema,
} from "../schemas/delegation.schemas";

export const delegationController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const query = delegationQuerySchema.parse(req.query);
      const result = await delegationService.getAll(query, req.user!.userId, req.user!.role);
      sendPaginated(res, result, "Delegation tasks fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch delegation tasks", e.status ?? 500);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const task = await delegationService.getById(Number(req.params.id));
      sendSuccess(res, task, "Delegation task fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Not found", e.status ?? 404);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createDelegationSchema.parse(req.body);
      const task = await delegationService.create(input);
      sendSuccess(res, task, "Delegation task created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create delegation task", e.status ?? 400);
    }
  },

  async importMany(req: Request, res: Response): Promise<void> {
    try {
      const input = importDelegationsSchema.parse(req.body);
      const result = await delegationService.importMany(input);
      sendSuccess(res, result, "Delegation import complete");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Import failed", e.status ?? 400);
    }
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { status } = updateDelegationStatusSchema.parse(req.body);
      const task = await delegationService.updateStatus(Number(req.params.id), status);
      sendSuccess(res, task, "Status updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update status", e.status ?? 400);
    }
  },

  async softDelete(req: Request, res: Response): Promise<void> {
    try {
      await delegationService.softDelete(Number(req.params.id), req.user!.role);
      sendSuccess(res, null, "Task deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete task", e.status ?? 400);
    }
  },

  async submit(req: Request, res: Response): Promise<void> {
    try {
      const input = submitDelegationSchema.parse(req.body);
      const history = await delegationService.submit(
        Number(req.params.id),
        input,
        req.user!.userId
      );
      sendSuccess(res, history, "Task submitted", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to submit task", e.status ?? 400);
    }
  },

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = delegationHistoryQuerySchema.parse(req.query);
      const result = await delegationService.getHistory(query, req.user!.userId, req.user!.role);
      sendPaginated(res, result, "History fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch history", e.status ?? 500);
    }
  },

  async markHistoryAdminDone(req: Request, res: Response): Promise<void> {
    try {
      const { historyIds } = adminDoneDelegationSchema.parse(req.body);
      const result = await delegationService.markHistoryAdminDone(historyIds);
      sendSuccess(res, result, `${result.count} items marked as admin done`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to mark admin done", e.status ?? 400);
    }
  },

  async listSubmissions(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Only admin can view delegation submissions", 403);
        return;
      }
      const submissions = await delegationService.listSubmissionsForReview();
      sendSuccess(res, submissions, "Delegation submissions fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch delegation submissions", e.status ?? 500);
    }
  },

  async approveSubmission(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Only admin can approve delegation submissions", 403);
        return;
      }
      const result = await delegationService.approveSubmission(Number(req.params.historyId), req.user!.userId);
      sendSuccess(res, result, "Submission approved");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to approve submission", e.status ?? 400);
    }
  },

  async rejectSubmission(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Only admin can reject delegation submissions", 403);
        return;
      }
      const { reviewNote } = reviewSubmissionSchema.parse(req.body);
      const result = await delegationService.rejectSubmission(
        Number(req.params.historyId),
        req.user!.userId,
        reviewNote
      );
      sendSuccess(res, result, "Submission rejected");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to reject submission", e.status ?? 400);
    }
  },

  async getStatusCounts(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const counts = await delegationService.getStatusCounts(userId, req.user!.role, req.user!.userId);
      sendSuccess(res, counts, "Status counts fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch counts", e.status ?? 500);
    }
  },

  async getMisStats(req: Request, res: Response): Promise<void> {
    try {
      const query = delegationMisQuerySchema.parse(req.query);
      const data = await delegationService.getMisStats(query, req.user!.role, req.user!.userId);
      sendSuccess(res, data, "Delegation MIS stats fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch delegation MIS stats", e.status ?? 500);
    }
  },

  async getMisStaffStats(req: Request, res: Response): Promise<void> {
    try {
      const query = delegationMisQuerySchema.parse(req.query);
      const data = await delegationService.getMisStaffStats(query);
      sendSuccess(res, data, "Delegation MIS staff stats fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch delegation MIS staff stats", e.status ?? 500);
    }
  },
};
