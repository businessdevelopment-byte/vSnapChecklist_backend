import { z } from "zod";

export const misKpiKraQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
  department: z.string().optional(),
});

export type MisKpiKraQueryInput = z.infer<typeof misKpiKraQuerySchema>;

export const createMisKpiKraSchema = z.object({
  name: z.string().min(1, "Name is required"),
  department: z.string().optional(),
  kpi: z.string().min(1, "KPI is required"),
  kra: z.string().min(1, "KRA is required"),
  target: z.coerce.number().int().nonnegative(),
  achieved: z.coerce.number().int().nonnegative(),
  percentage: z.coerce.number().int().min(0).max(100),
  period: z.string().optional(),
  remarks: z.string().optional(),
});

export type CreateMisKpiKraInput = z.infer<typeof createMisKpiKraSchema>;

export const updateMisKpiKraSchema = createMisKpiKraSchema.partial();

export type UpdateMisKpiKraInput = z.infer<typeof updateMisKpiKraSchema>;
