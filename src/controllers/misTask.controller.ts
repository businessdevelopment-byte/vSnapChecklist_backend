import { Request, Response } from "express";
import { misTaskService } from "../services/misTask.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  misTaskQuerySchema,
  createMisTaskSchema,
  updateMisTaskSchema,
} from "../schemas/misTask.schemas";

export const misTaskController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = misTaskQuerySchema.parse(req.query);
      const result = await misTaskService.list(query);
      sendPaginated(res, result, "MIS tasks fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch MIS tasks", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = createMisTaskSchema.parse(req.body);
      const task = await misTaskService.create(input);
      sendSuccess(res, task, "MIS task created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create MIS task", e.status ?? 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const id = Number(req.params.id);
      const input = updateMisTaskSchema.parse(req.body);
      const task = await misTaskService.update(id, input);
      sendSuccess(res, task, "MIS task updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update MIS task", e.status ?? 400);
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const id = Number(req.params.id);
      const result = await misTaskService.remove(id);
      sendSuccess(res, result, "MIS task deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete MIS task", e.status ?? 400);
    }
  },
};
