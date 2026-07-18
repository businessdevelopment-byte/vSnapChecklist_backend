import { Request, Response } from "express";
import { onboardingChecklistService } from "../services/onboardingChecklist.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { onboardingChecklistQuerySchema, createOnboardingChecklistSchema } from "../schemas/onboardingChecklist.schemas";

export const onboardingChecklistController = {
  async listPending(req: Request, res: Response): Promise<void> {
    try {
      const query = onboardingChecklistQuerySchema.parse(req.query);
      const result = await onboardingChecklistService.listPending(query);
      sendPaginated(res, result, "Pending employees fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch pending employees", e.status ?? 500);
    }
  },

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = onboardingChecklistQuerySchema.parse(req.query);
      const result = await onboardingChecklistService.listHistory(query);
      sendPaginated(res, result, "Onboarding checklists fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch onboarding checklists", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createOnboardingChecklistSchema.parse(req.body);
      const checklist = await onboardingChecklistService.create(input);
      sendSuccess(res, checklist, "Onboarding checklist saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save onboarding checklist", e.status ?? 400);
    }
  },
};
