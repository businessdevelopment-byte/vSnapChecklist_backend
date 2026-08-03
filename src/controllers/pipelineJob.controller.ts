import { Request, Response } from "express";
import { pipelineJobService } from "../services/pipelineJob.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createPoliticalJobSchema } from "../schemas/pipelineJob.schemas";

export const pipelineJobController = {
  async createPoliticalJob(req: Request, res: Response): Promise<void> {
    try {
      const input = createPoliticalJobSchema.parse(req.body);
      const job = await pipelineJobService.createPoliticalJob(input, req.user!.userId);
      sendSuccess(res, job, "Job card created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create job card", e.status ?? 400);
    }
  },
};
