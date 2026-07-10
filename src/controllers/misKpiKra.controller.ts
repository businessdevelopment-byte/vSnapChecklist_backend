import { Request, Response } from "express";
import { misKpiKraService } from "../services/misKpiKra.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import {
  misKpiKraQuerySchema,
  createMisKpiKraSchema,
  updateMisKpiKraSchema,
} from "../schemas/misKpiKra.schemas";

export const misKpiKraController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = misKpiKraQuerySchema.parse(req.query);
      const result = await misKpiKraService.list(query, {
        userId: req.user!.userId,
        role: req.user!.role,
      });
      sendPaginated(res, result, "KPI/KRA entries fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch KPI/KRA entries", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = createMisKpiKraSchema.parse(req.body);
      const entry = await misKpiKraService.create(input);
      sendSuccess(res, entry, "KPI/KRA entry created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create KPI/KRA entry", e.status ?? 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const id = Number(req.params.id);
      const input = updateMisKpiKraSchema.parse(req.body);
      const entry = await misKpiKraService.update(id, input);
      sendSuccess(res, entry, "KPI/KRA entry updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update KPI/KRA entry", e.status ?? 400);
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const id = Number(req.params.id);
      const result = await misKpiKraService.remove(id);
      sendSuccess(res, result, "KPI/KRA entry deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete KPI/KRA entry", e.status ?? 400);
    }
  },
};
