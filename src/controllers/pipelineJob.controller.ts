import { Request, Response } from "express";
import { pipelineJobService } from "../services/pipelineJob.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createPmsJobSchema } from "../schemas/pipelineJob.schemas";

export const pipelineJobController = {
  async createPmsJob(req: Request, res: Response): Promise<void> {
    try {
      const input = createPmsJobSchema.parse(req.body);
      const job = await pipelineJobService.createPmsJob(input);
      sendSuccess(res, job, "Job created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create job", e.status ?? 400);
    }
  },
};
