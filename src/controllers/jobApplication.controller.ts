import { Request, Response } from "express";
import { jobApplicationService } from "../services/jobApplication.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createJobApplicationSchema, listJobApplicationSchema } from "../schemas/jobApplication.schemas";

export const jobApplicationController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const filters = listJobApplicationSchema.parse(req.query);
      const applications = await jobApplicationService.list(filters);
      sendSuccess(res, applications, "Job applications fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch job applications", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createJobApplicationSchema.parse(req.body);
      const application = await jobApplicationService.create(input, req.user!.userId);
      sendSuccess(res, application, "Job application created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create job application", e.status ?? 400);
    }
  },

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const application = await jobApplicationService.getById(Number(req.params.id));
      if (!application) {
        sendError(res, "Job application not found", 404);
        return;
      }
      sendSuccess(res, application, "Job application fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch job application", e.status ?? 500);
    }
  },
};
