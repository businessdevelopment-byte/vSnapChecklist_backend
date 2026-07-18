import type { Request, Response } from "express";
import { sendError, sendSuccess } from "../utils/apiResponse";
import { permissionService } from "../services/permission.service";
import { assignSectionPermissionSchema, removeSectionPermissionSchema } from "../schemas/permission.schemas";

export const permissionController = {
  async getUserPermissions(req: Request, res: Response) {
    try {
      const userId = parseInt(req.params.userId as string);
      if (!userId) {
        return sendError(res, "User ID is required", 400);
      }

      const permissions = await permissionService.getUserPermissions(userId);
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
      const { userId, sectionKeys } = req.body;

      if (!userId || !Array.isArray(sectionKeys)) {
        return sendError(res, "Invalid input", 400);
      }

      if (req.user?.role !== "ADMIN") {
        return sendError(res, "Only admins can set permissions", 403);
      }

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
};
