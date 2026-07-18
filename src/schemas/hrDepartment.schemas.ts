import { z } from "zod";

export const createHrDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  hodName: z.string().optional().nullable(),
});

export const updateHrDepartmentSchema = createHrDepartmentSchema.partial();

export type CreateHrDepartmentInput = z.infer<typeof createHrDepartmentSchema>;
export type UpdateHrDepartmentInput = z.infer<typeof updateHrDepartmentSchema>;
