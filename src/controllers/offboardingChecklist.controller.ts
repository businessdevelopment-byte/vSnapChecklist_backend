import { Request, Response } from "express";
import { offboardingChecklistService } from "../services/offboardingChecklist.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  offboardingChecklistQuerySchema,
  createOffboardingChecklistSchema,
} from "../schemas/offboardingChecklist.schemas";

export const offboardingChecklistController = {
  async listPending(req: Request, res: Response): Promise<void> {
    try {
      const query = offboardingChecklistQuerySchema.parse(req.query);
      const result = await offboardingChecklistService.listPending(query);
      sendPaginated(res, result, "Pending leaving employees fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch pending leaving employees", e.status ?? 500);
    }
  },

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = offboardingChecklistQuerySchema.parse(req.query);
      const result = await offboardingChecklistService.listHistory(query);
      sendPaginated(res, result, "Offboarding checklists fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch offboarding checklists", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createOffboardingChecklistSchema.parse(req.body);
      const checklist = await offboardingChecklistService.create(input);
      sendSuccess(res, checklist, "Offboarding checklist saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save offboarding checklist", e.status ?? 400);
    }
  },
};
