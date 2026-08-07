import { Request, Response } from "express";
import { checklistService } from "../services/checklist.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  checklistQuerySchema,
  submitChecklistSchema,
  adminDoneSchema,
  leaveSchema,
  checklistStatsQuerySchema,
  previewQuerySchema,
  transferredInQuerySchema,
  leaveLogsQuerySchema,
} from "../schemas/checklist.schemas";

export const checklistController = {
  async getEntries(req: Request, res: Response): Promise<void> {
    try {
      const query = checklistQuerySchema.parse(req.query);
      const result = await checklistService.getEntries(
        query,
        req.user!.userId,
        req.user!.role
      );
      sendPaginated(res, result, "Checklist entries fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch checklist", e.status ?? 500);
    }
  },

  async getTransferredIn(req: Request, res: Response): Promise<void> {
    try {
      const query = transferredInQuerySchema.parse(req.query);
      const result = await checklistService.getTransferredIn(
        query,
        req.user!.userId,
        req.user!.role
      );
      sendSuccess(res, result, "Transferred-in tasks fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch transferred-in tasks", e.status ?? 500);
    }
  },

  async previewUpcoming(req: Request, res: Response): Promise<void> {
    try {
      const query = previewQuerySchema.parse(req.query);
      const result = await checklistService.previewUpcoming(
        query,
        req.user!.userId,
        req.user!.role
      );
      sendSuccess(res, result, "Upcoming tasks previewed");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to preview upcoming tasks", e.status ?? 400);
    }
  },

  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = checklistQuerySchema.parse(req.query);
      const result = await checklistService.getHistory(
        query,
        req.user!.userId,
        req.user!.role
      );
      sendPaginated(res, result, "History fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch history", e.status ?? 500);
    }
  },

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const query = checklistStatsQuerySchema.parse(req.query);
      const stats = await checklistService.getStats(
        query,
        req.user!.userId,
        req.user!.role
      );
      sendSuccess(res, stats, "Stats fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch stats", e.status ?? 500);
    }
  },

  async getStaffStats(req: Request, res: Response): Promise<void> {
    try {
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const stats = await checklistService.getStaffStats({ startDate, endDate, departmentId, userId });
      sendSuccess(res, stats, "Staff stats fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch staff stats", e.status ?? 500);
    }
  },

  async getMonthlyStats(req: Request, res: Response): Promise<void> {
    try {
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
      const stats = await checklistService.getMonthlyStats(year, userId, departmentId);
      sendSuccess(res, stats, "Monthly stats fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch monthly stats", e.status ?? 500);
    }
  },

  async submit(req: Request, res: Response): Promise<void> {
    try {
      const entryId = BigInt(req.params.id as string);
      const input = submitChecklistSchema.parse(req.body);
      const entry = await checklistService.submitEntry(
        entryId,
        input,
        req.user!.userId,
        req.user!.role
      );
      sendSuccess(res, entry, "Task submitted successfully");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to submit task", e.status ?? 400);
    }
  },

  async markAdminDone(req: Request, res: Response): Promise<void> {
    try {
      const input = adminDoneSchema.parse(req.body);
      const result = await checklistService.markAdminDone(input.entryIds);
      sendSuccess(res, result, `${result.count} entries marked as admin done`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to mark admin done", e.status ?? 400);
    }
  },

  async markLeave(req: Request, res: Response): Promise<void> {
    try {
      const input = leaveSchema.parse(req.body);
      const result = await checklistService.markLeave(input, req.user!.userId, req.user!.role);
      sendSuccess(res, result, `${result.count} tasks marked as leave`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to mark leave", e.status ?? 400);
    }
  },

  async getLeaveLogs(req: Request, res: Response): Promise<void> {
    try {
      const query = leaveLogsQuerySchema.parse(req.query);
      const logs = await checklistService.getLeaveLogs(query, req.user!.userId, req.user!.role);
      sendSuccess(res, logs, "Leave logs fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch leave logs", e.status ?? 500);
    }
  },

  async getCalendarSummary(req: Request, res: Response): Promise<void> {
    try {
      const startDate = (req.query.startDate as string) ?? new Date().toISOString().slice(0, 7) + "-01";
      const endDate   = (req.query.endDate   as string) ?? new Date().toISOString().slice(0, 10);
      const filterUserId = req.query.userId ? Number(req.query.userId) : undefined;
      const summary = await checklistService.getCalendarSummary(
        startDate,
        endDate,
        req.user!.userId,
        req.user!.role,
        filterUserId
      );
      sendSuccess(res, summary, "Calendar summary fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch calendar summary", e.status ?? 500);
    }
  },

  async backfillAll(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const { fromDate, toDate } = req.body as { fromDate?: string; toDate?: string };
      const from = fromDate ? new Date(fromDate) : (() => { const d = new Date(); d.setDate(d.getDate() - 90); return d; })();
      const to   = toDate   ? new Date(toDate)   : new Date();
      const result = await checklistService.backfillAll(from, to);
      sendSuccess(res, result, `Backfill complete: ${result.created} entries created for ${result.users} users`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Backfill failed", e.status ?? 500);
    }
  },
};
