import { Request, Response } from "express";
import { pipelineJobService } from "../services/pipelineJob.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createJobCardsBatchSchema } from "../schemas/pipelineJob.schemas";

export const pipelineJobController = {
  async createJobCardsBatch(req: Request, res: Response): Promise<void> {
    try {
      const input = createJobCardsBatchSchema.parse(req.body);
      const jobs = await pipelineJobService.createJobCardsBatch(input, req.user!.userId);
      sendSuccess(res, jobs, `${jobs.length} job card(s) created`, 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create job cards", e.status ?? 400);
    }
  },
};
