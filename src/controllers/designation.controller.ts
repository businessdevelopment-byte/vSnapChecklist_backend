import { Request, Response } from "express";
import { designationService } from "../services/designation.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createDesignationSchema, updateDesignationSchema } from "../schemas/designation.schemas";

export const designationController = {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const designations = await designationService.list();
      sendSuccess(res, designations, "Designations fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch designations", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = createDesignationSchema.parse(req.body);
      const designation = await designationService.create(input);
      sendSuccess(res, designation, "Designation created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create designation", e.status ?? 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = updateDesignationSchema.parse(req.body);
      const designation = await designationService.update(Number(req.params.id), input);
      sendSuccess(res, designation, "Designation updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update designation", e.status ?? 400);
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const result = await designationService.delete(Number(req.params.id));
      sendSuccess(res, result, "Designation deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete designation", e.status ?? 400);
    }
  },
};
