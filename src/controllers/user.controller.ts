import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { createUserSchema, updateUserStatusSchema, updateUserRoleSchema, updateUserDeptSchema, updateMyProfileSchema, importUsersSchema } from "../schemas/user.schemas";

export const userController = {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const users = await userService.getAll();
      sendSuccess(res, users, "Users fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch users", e.status ?? 500);
    }
  },

  async getMe(req: Request, res: Response): Promise<void> {
    try {
      const user = await userService.getMe(req.user!.userId);
      sendSuccess(res, user, "Profile fetched");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to fetch profile", e.status ?? 500);
    }
  },

  async updateMe(req: Request, res: Response): Promise<void> {
    try {
      const data = updateMyProfileSchema.parse(req.body);
      const user = await userService.updateMe(req.user!.userId, data);
      sendSuccess(res, user, "Profile updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update profile", e.status ?? 400);
    }
  },

  async create(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = createUserSchema.parse(req.body);
      const user = await userService.create(input);
      sendSuccess(res, user, "User created", 201);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to create user", e.status ?? 400);
    }
  },

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const { status } = updateUserStatusSchema.parse(req.body);
      const user = await userService.updateStatus(Number(req.params.id), status);
      sendSuccess(res, user, "User status updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update status", e.status ?? 400);
    }
  },

  async updateRole(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const { role } = updateUserRoleSchema.parse(req.body);
      const user = await userService.updateRole(Number(req.params.id), role);
      sendSuccess(res, user, "User role updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update role", e.status ?? 400);
    }
  },

  async updateDepartment(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") { sendError(res, "Admin only", 403); return; }
      const { departmentId } = updateUserDeptSchema.parse(req.body);
      const user = await userService.updateDepartment(Number(req.params.id), departmentId);
      sendSuccess(res, user, "User department updated");
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Failed to update department", e.status ?? 400);
    }
  },

  async importMany(req: Request, res: Response): Promise<void> {
    try {
      if (req.user!.role !== "ADMIN") {
        sendError(res, "Admin only", 403);
        return;
      }
      const input = importUsersSchema.parse(req.body);
      const result = await userService.importMany(input);
      sendSuccess(res, result, `Import done: ${result.created} created, ${result.skipped} skipped`);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      sendError(res, e.message ?? "Import failed", e.status ?? 400);
    }
  },
};
