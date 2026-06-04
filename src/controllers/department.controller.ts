import { Request, Response } from "express";
import { departmentService } from "../services/department.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createDepartmentSchema, updateDepartmentSchema } from "../schemas/department.schemas";

export const departmentController = {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const departments = await departmentService.getAll();
      sendSuccess(res, departments, "Departments fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch departments", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const { name, givenBy } = createDepartmentSchema.parse(req.body);
      const dept = await departmentService.create(name, givenBy);
      sendSuccess(res, dept, "Department created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create department", e.status ?? 400);
    }
  },

  async update(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const data = updateDepartmentSchema.parse(req.body);
      const dept = await departmentService.update(Number(req.params.id), data);
      sendSuccess(res, dept, "Department updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update department", e.status ?? 400);
    }
  },

  async remove(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const result = await departmentService.remove(Number(req.params.id));
      sendSuccess(res, result, "Department deleted");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete department", e.status ?? 400);
    }
  },
};
