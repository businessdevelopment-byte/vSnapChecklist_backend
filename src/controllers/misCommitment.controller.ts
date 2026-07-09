import { Request, Response } from "express";
import { misCommitmentService } from "../services/misCommitment.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  misCommitmentQuerySchema,
  submitMisCommitmentsSchema,
} from "../schemas/misCommitment.schemas";

export const misCommitmentController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = misCommitmentQuerySchema.parse(req.query);
      const result = await misCommitmentService.list(query, {
        userId: req.user!.userId,
        role: req.user!.role,
      });
      sendPaginated(res, result, "MIS archived commitments fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch MIS archived commitments", e.status ?? 500);
    }
  },

  async submit(req: Request, res: Response): Promise<void> {
    try {
      const input = submitMisCommitmentsSchema.parse(req.body);
      const result = await misCommitmentService.submit(input, {
        userId: req.user!.userId,
        role: req.user!.role,
      });
      sendSuccess(res, result, "Commitments saved", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to save commitments", e.status ?? 400);
    }
  },
};
