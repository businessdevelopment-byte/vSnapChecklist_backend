import { Request, Response } from "express";
import { hrDepartmentService } from "../services/hrDepartment.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createHrDepartmentSchema, updateHrDepartmentSchema } from "../schemas/hrDepartment.schemas";

export const hrDepartmentController = {
  async list(_req: Request, res: Response): Promise<void> {
    try {
      const departments = await hrDepartmentService.list();
      sendSuccess(res, departments, "HR Departments fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch departments", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = createHrDepartmentSchema.parse(req.body);
      const dept = await hrDepartmentService.create(input);
      sendSuccess(res, dept, "HR Department created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create department", e.status ?? 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = updateHrDepartmentSchema.parse(req.body);
      const dept = await hrDepartmentService.update(Number(req.params.id), input);
      sendSuccess(res, dept, "HR Department updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update department", e.status ?? 400);
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const result = await hrDepartmentService.delete(Number(req.params.id));
      sendSuccess(res, result, "HR Department deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete department", e.status ?? 400);
    }
  },
};
