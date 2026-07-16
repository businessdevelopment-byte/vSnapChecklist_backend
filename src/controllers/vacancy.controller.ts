import { Request, Response } from "express";
import { vacancyService } from "../services/vacancy.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createVacancySchema, updateVacancySchema, vacancyApprovalSchema } from "../schemas/vacancy.schemas";

export const vacancyController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const filters = {
        status: (req.query.status as string) || undefined,
        approvalStatus: (req.query.approvalStatus as string) || undefined,
      };
      const vacancies = await vacancyService.list(filters);
      sendSuccess(res, vacancies, "Vacancies fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch vacancies", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = createVacancySchema.parse(req.body);
      const vacancy = await vacancyService.create(input);
      sendSuccess(res, vacancy, "Vacancy created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create vacancy", e.status ?? 400);
    }
  },

  async getByNumber(req: Request, res: Response): Promise<void> {
    try {
      const vacancyNumber = String(req.params.vacancyNumber);
      const vacancy = await vacancyService.getByNumber(vacancyNumber);
      if (!vacancy) {
        sendError(res, "Vacancy not found", 404);
        return;
      }
      sendSuccess(res, vacancy, "Vacancy fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch vacancy", e.status ?? 500);
    }
  },

  async updateByNumber(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const vacancyNumber = String(req.params.vacancyNumber);
      const input = updateVacancySchema.parse(req.body);
      const vacancy = await vacancyService.updateByNumber(vacancyNumber, input);
      sendSuccess(res, vacancy, "Vacancy updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update vacancy", e.status ?? 400);
    }
  },

  async updateApproval(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const vacancyNumber = String(req.params.vacancyNumber);
      const input = vacancyApprovalSchema.parse(req.body);
      const vacancy = await vacancyService.updateApproval(vacancyNumber, input);
      sendSuccess(res, vacancy, "Vacancy approval status updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update vacancy approval", e.status ?? 400);
    }
  },

  async deleteByNumber(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const vacancyNumber = String(req.params.vacancyNumber);
      const result = await vacancyService.deleteByNumber(vacancyNumber);
      sendSuccess(res, result, "Vacancy deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete vacancy", e.status ?? 400);
    }
  },
};
