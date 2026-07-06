import { Request, Response } from "express";
import { employeeService } from "../services/employee.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/apiResponse";
import { employeeQuerySchema, createEmployeeSchema, updateMyProfileEmployeeSchema } from "../schemas/employee.schemas";

export const employeeController = {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const query = employeeQuerySchema.parse(req.query);
      const result = await employeeService.list(query);
      sendPaginated(res, result, "Employees fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch employees", e.status ?? 500);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      const input = createEmployeeSchema.parse(req.body);
      const employee = await employeeService.create(input);
      sendSuccess(res, employee, "Employee created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create employee", e.status ?? 400);
    }
  },

  async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const employee = await employeeService.getMyProfile(req.user!.userId);
      sendSuccess(res, employee, "My profile fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch my profile", e.status ?? 500);
    }
  },

  async updateMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const input = updateMyProfileEmployeeSchema.parse(req.body);
      const employee = await employeeService.updateMyProfile(req.user!.userId, input);
      sendSuccess(res, employee, "Profile updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update my profile", e.status ?? 400);
    }
  },
};
