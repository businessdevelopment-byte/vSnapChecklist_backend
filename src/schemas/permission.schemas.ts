import { z } from "zod";

export const assignSectionPermissionSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  sectionKeys: z.array(z.string().min(1)).min(1, "At least one section must be selected"),
});

export const removeSectionPermissionSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
  sectionKeys: z.array(z.string().min(1)).min(1, "At least one section must be removed"),
});

export const getUserPermissionsSchema = z.object({
  userId: z.number().int().positive("User ID must be a positive integer"),
});

export type AssignSectionPermissionInput = z.infer<typeof assignSectionPermissionSchema>;
export type RemoveSectionPermissionInput = z.infer<typeof removeSectionPermissionSchema>;
export type GetUserPermissionsInput = z.infer<typeof getUserPermissionsSchema>;
