import { Request, Response } from "express";
import { departmentService } from "../services/department.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentListQuerySchema,
  importDepartmentsSchema,
  departmentIdsSchema,
} from "../schemas/department.schemas";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const departmentController = {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { usage } = departmentListQuerySchema.parse(req.query);
      const departments = await departmentService.getAll(usage === "1");
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

  async importMany(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const { rows } = importDepartmentsSchema.parse(req.body);
      const result = await departmentService.importMany(rows);
      sendSuccess(res, result, `${plural(result.created.length, "department")} created`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to import departments", e.status ?? 400);
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

  async removeMany(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const { ids } = departmentIdsSchema.parse(req.body);
      const result = await departmentService.removeMany(ids);
      sendSuccess(res, result, `${plural(result.deleted.length, "department")} deleted`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to delete departments", e.status ?? 400);
    }
  },
};
