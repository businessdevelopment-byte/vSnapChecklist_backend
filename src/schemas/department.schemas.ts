import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  givenBy: z.string().optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  givenBy: z.string().optional(),
});

// "1" adds per-department usage counts (users + tasks) — only Settings needs
// them, the pickers that share this endpoint don't pay for the extra counts.
export const departmentListQuerySchema = z.object({
  usage: z.enum(["0", "1"]).optional(),
});

export const importDepartmentsSchema = z.object({
  rows: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    givenBy: z.string().trim().max(100).optional(),
  })).min(1).max(1000),
});

export const departmentIdsSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(1000),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type ImportDepartmentsInput = z.infer<typeof importDepartmentsSchema>;
