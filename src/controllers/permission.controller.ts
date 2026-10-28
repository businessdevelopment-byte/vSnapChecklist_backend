import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { permissionService } from "../services/permission.service";
import {
  assignSectionPermissionSchema,
  removeSectionPermissionSchema,
  setUserPermissionsSchema,
  setDepartmentPermissionsSchema,
  setDefaultPermissionsSchema,
} from "../schemas/permission.schemas";

export const permissionController = {
  // Effective access (own + department + default grants) — what the sidebar
  // shows. Staff may only read their own; it used to answer for anyone.
  async getUserPermissions(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId as string);
      if (!userId) {
        return sendError(res, "User ID is required", 400);
      }
      if (req.user!.role !== "ADMIN" && req.user!.userId !== userId) {
        return sendError(res, "You can only view your own permissions", 403);
      }

      const permissions = await permissionService.getEffectivePermissions(userId);
      return sendSuccess(res, permissions, "User permissions fetched successfully");
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      return sendError(res, "Failed to fetch user permissions", 500);
    }
  },

  async assignSectionPermissions(req: Request, res: Response) {
    try {
      const parsed = assignSectionPermissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Invalid input", 400, parsed.error.errors);
      }

      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can assign permissions", 403);
      }

      const permissions = await permissionService.assignSectionPermissions(parsed.data);
      return sendSuccess(res, permissions, "Permissions assigned successfully");
    } catch (error: any) {
      console.error("Error assigning permissions:", error);
      if (error.code === "P2025") {
        return sendError(res, "User not found", 404);
      }
      return sendError(res, "Failed to assign permissions", 500);
    }
  },

  async removeSectionPermissions(req: Request, res: Response) {
    try {
      const parsed = removeSectionPermissionSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Invalid input", 400, parsed.error.errors);
      }

      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can remove permissions", 403);
      }

      const permissions = await permissionService.removeSectionPermissions(parsed.data);
      return sendSuccess(res, permissions, "Permissions removed successfully");
    } catch (error: any) {
      console.error("Error removing permissions:", error);
      if (error.code === "P2025") {
        return sendError(res, "User not found", 404);
      }
      return sendError(res, "Failed to remove permissions", 500);
    }
  },

  async setUserPermissions(req: Request, res: Response) {
    try {
      const parsed = setUserPermissionsSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Invalid input", 400, parsed.error.errors);
      }

      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can set permissions", 403);
      }

      const { userId, sectionKeys } = parsed.data;
      const permissions = await permissionService.setUserPermissions(userId, sectionKeys);
      return sendSuccess(res, permissions, "User permissions updated successfully");
    } catch (error: any) {
      console.error("Error setting permissions:", error);
      if (error.code === "P2025") {
        return sendError(res, "User not found", 404);
      }
      return sendError(res, "Failed to set permissions", 500);
    }
  },

  async getAllUserPermissions(req: Request, res: Response) {
    try {
      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can view all permissions", 403);
      }

      const userPermissions = await permissionService.getAllUserPermissions();
      return sendSuccess(res, userPermissions, "All user permissions fetched successfully");
    } catch (error) {
      console.error("Error fetching all user permissions:", error);
      return sendError(res, "Failed to fetch user permissions", 500);
    }
  },

  async getDepartmentPermissions(req: Request, res: Response) {
    try {
      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can view department permissions", 403);
      }
      const departments = await permissionService.getDepartmentPermissions();
      return sendSuccess(res, departments, "Department permissions fetched successfully");
    } catch (error) {
      console.error("Error fetching department permissions:", error);
      return sendError(res, "Failed to fetch department permissions", 500);
    }
  },

  async setDepartmentPermissions(req: Request, res: Response) {
    try {
      const parsed = setDepartmentPermissionsSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Invalid input", 400, parsed.error.errors);
      }
      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can set department permissions", 403);
      }
      const sections = await permissionService.setDepartmentPermissions(parsed.data.departmentId, parsed.data.sectionKeys);
      return sendSuccess(res, sections, "Department permissions updated successfully");
    } catch (error: any) {
      console.error("Error setting department permissions:", error);
      if (error.code === "P2025") {
        return sendError(res, "Department not found", 404);
      }
      return sendError(res, "Failed to set department permissions", 500);
    }
  },

  async getDefaultPermissions(req: Request, res: Response) {
    try {
      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can view default permissions", 403);
      }
      const sections = await permissionService.getDefaultPermissions();
      return sendSuccess(res, sections, "Default permissions fetched successfully");
    } catch (error) {
      console.error("Error fetching default permissions:", error);
      return sendError(res, "Failed to fetch default permissions", 500);
    }
  },

  async setDefaultPermissions(req: Request, res: Response) {
    try {
      const parsed = setDefaultPermissionsSchema.safeParse(req.body);
      if (!parsed.success) {
        return sendError(res, "Invalid input", 400, parsed.error.errors);
      }
      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can set default permissions", 403);
      }
      const sections = await permissionService.setDefaultPermissions(parsed.data.sectionKeys);
      return sendSuccess(res, sections, "Default permissions updated successfully");
    } catch (error) {
      console.error("Error setting default permissions:", error);
      return sendError(res, "Failed to set default permissions", 500);
    }
  },
};
