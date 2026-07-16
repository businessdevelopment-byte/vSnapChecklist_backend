import { z } from "zod";

export const createDesignationSchema = z.object({
  name: z.string().min(1, "Designation name is required"),
  departmentId: z.number().int().positive("Department is required"),
});

export const updateDesignationSchema = createDesignationSchema.partial();

export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;
export type UpdateDesignationInput = z.infer<typeof updateDesignationSchema>;
