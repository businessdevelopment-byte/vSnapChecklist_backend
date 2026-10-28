import { Request, Response } from "express";
import { ZodError } from "zod";
import { delegationService } from "../services/delegation.service";
import { permissionService, ADMIN_APPROVE_SECTION } from "../services/permission.service";
import { sendSuccess, sendPaginated, sendError, formatZodRowErrors } from "../utils/apiResponse";
import {
  createDelegationSchema,
  updateDelegationStatusSchema,
  submitDelegationSchema,
  adminDoneDelegationSchema,
  reviewSubmissionSchema,
  delegationQuerySchema,
  delegationCountsQuerySchema,
  delegationHistoryQuerySchema,
  delegationMisQuerySchema,
  importDelegationsSchema,
  deleteDelegationsSchema,
} from "../schemas/delegation.schemas";
import { reportQuerySchema } from "../schemas/report.schemas";

function parseTaskId(req: Request, res: Response): number | null {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    sendError(res, "Invalid task ID", 400);
    return null;
  }
  return id;
}

export const delegationController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const query = delegationQuerySchema.parse(req.query);
      const result = await delegationService.getAll(query, req.user!.userId, req.user!.role);
      sendPaginated(res, result, "Delegation tasks fetched");
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        sendError(res, err.issues[0]?.message ?? "Invalid filters", 400);
        return;
      }
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch delegation tasks", e.status ?? 500);
    }
  },

  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const query = reportQuerySchema.parse(req.query);
      const result = await delegationService.getReport(query, req.user!.userId, req.user!.role);
      sendSuccess(res, result, "Delegation report generated");
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        sendError(res, err.issues[0]?.message ?? "Invalid report filters", 400);
        return;
      }
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to generate delegation report", e.status ?? 500);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = parseTaskId(req, res);
    if (id === null) return;
    try {
      const task = await delegationService.getById(id);
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
      // Creates and overwrites other people's tasks — admins only.
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const input = importDelegationsSchema.parse(req.body);
      const result = await delegationService.importMany(input);
      sendSuccess(
        res,
        result,
        `Delegation import complete: ${result.created} created, ${result.updated} updated, ${result.keptAppProgress} kept (worked on in the app), ${result.errors.length} errors`
      );
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        sendError(res, "Some rows failed validation", 400, formatZodRowErrors(err));
        return;
      }
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Import failed", e.status ?? 400);
    }
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    const id = parseTaskId(req, res);
    if (id === null) return;
    try {
      const { status } = updateDelegationStatusSchema.parse(req.body);
      const task = await delegationService.updateStatus(id, status);
      sendSuccess(res, task, "Status updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update status", e.status ?? 400);
    }
  },

  async softDelete(req: Request, res: Response): Promise<void> {
    const id = parseTaskId(req, res);
    if (id === null) return;
    try {
      await delegationService.softDelete(id, req.user!.role);
      sendSuccess(res, null, "Task deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete task", e.status ?? 400);
    }
  },

  async deletePreview(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const { ids } = deleteDelegationsSchema.parse(req.body);
      const preview = await delegationService.previewHardDelete(ids);
      sendSuccess(res, preview, "Delete preview fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch delete preview", e.status ?? 400);
    }
  },

  async hardDeleteMany(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const { ids } = deleteDelegationsSchema.parse(req.body);
      const result = await delegationService.hardDeleteMany(ids, req.user!.userId);
      sendSuccess(res, result, `${result.deleted} delegation task(s) deleted`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete tasks", e.status ?? 400);
    }
  },

  async submit(req: Request, res: Response): Promise<void> {
    const id = parseTaskId(req, res);
    if (id === null) return;
    try {
      const input = submitDelegationSchema.parse(req.body);
      const history = await delegationService.submit(id, input, req.user!.userId);
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
      // Admins, and anyone granted Admin Approve (own, department or default).
      if (!(await permissionService.canAccessSection(req.user!, ADMIN_APPROVE_SECTION))) {
        sendError(res, "You don't have access to Admin Approve", 403);
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
      // Admins, and anyone granted Admin Approve (own, department or default).
      if (!(await permissionService.canAccessSection(req.user!, ADMIN_APPROVE_SECTION))) {
        sendError(res, "You don't have access to Admin Approve", 403);
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
      // Admins, and anyone granted Admin Approve (own, department or default).
      if (!(await permissionService.canAccessSection(req.user!, ADMIN_APPROVE_SECTION))) {
        sendError(res, "You don't have access to Admin Approve", 403);
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
      const query = delegationCountsQuerySchema.parse(req.query);
      const counts = await delegationService.getStatusCounts(query, req.user!.role, req.user!.userId);
      sendSuccess(res, counts, "Status counts fetched");
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        sendError(res, err.issues[0]?.message ?? "Invalid filters", 400);
        return;
      }
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
      // Non-admins never see another user's data, regardless of what's in the query string.
      const userId = req.user!.role === "ADMIN" ? query.userId : req.user!.userId;
      const data = await delegationService.getMisStaffStats({ ...query, userId });
      sendSuccess(res, data, "Delegation MIS staff stats fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch delegation MIS staff stats", e.status ?? 500);
    }
  },
};
