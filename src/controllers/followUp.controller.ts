import { Request, Response } from "express";
import { followUpService } from "../services/followUp.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { followUpQuerySchema, createFollowUpSchema } from "../schemas/followUp.schemas";

export const followUpController = {
  async listCallableEnquiries(req: Request, res: Response): Promise<void> {
    try {
      const query = followUpQuerySchema.parse(req.query);
      const result = await followUpService.listCallableEnquiries(query);
      sendPaginated(res, result, "Callable enquiries fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch callable enquiries", e.status ?? 500);
    }
  },

  async listHistory(req: Request, res: Response): Promise<void> {
    try {
      const query = followUpQuerySchema.parse(req.query);
      const result = await followUpService.listHistory(query);
      sendPaginated(res, result, "Follow-ups fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch follow-ups", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createFollowUpSchema.parse(req.body);
      const followUp = await followUpService.create(input);
      sendSuccess(res, followUp, "Follow-up saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save follow-up", e.status ?? 400);
    }
  },
};
