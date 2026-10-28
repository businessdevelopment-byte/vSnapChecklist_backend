import { z } from "zod";

// "{system-key}:{page-slug}", e.g. "checklist-delegation:admin-approve" (see
// the frontend's lib/navigation.ts sectionKeyOf).
const sectionKey = z.string().regex(/^[\w-]+:[\w-]+$/, "Invalid section key");

export const assignSectionPermissionSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  sectionKeys: z.array(sectionKey).min(1, "At least one section must be selected"),
});

export const removeSectionPermissionSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  sectionKeys: z.array(sectionKey).min(1, "At least one section must be removed"),
});

export const getUserPermissionsSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
});

// The "set" endpoints replace the whole list; an empty list clears it.
export const setUserPermissionsSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  sectionKeys: z.array(sectionKey),
});

export const setDepartmentPermissionsSchema = z.object({
  departmentId: z.number().int().positive("Department ID must be a positive integer"),
  sectionKeys: z.array(sectionKey),
});

export const setDefaultPermissionsSchema = z.object({
  sectionKeys: z.array(sectionKey),
});

export type AssignSectionPermissionInput = z.infer<typeof assignSectionPermissionSchema>;
export type RemoveSectionPermissionInput = z.infer<typeof removeSectionPermissionSchema>;
export type GetUserPermissionsInput = z.infer<typeof getUserPermissionsSchema>;
