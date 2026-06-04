import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  givenBy: z.string().optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  givenBy: z.string().optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
