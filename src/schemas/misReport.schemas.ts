import { z } from "zod";

export const misReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type MisReportQueryInput = z.infer<typeof misReportQuerySchema>;

export const createMisReportEntrySchema = z.object({
  name: z.string().min(1, "Name is required"),
  department: z.string().min(1, "Department is required"),
  dateStart: z.string().min(1, "Start date is required"),
  dateEnd: z.string().min(1, "End date is required"),
  target: z.coerce.number().int().nonnegative(),
  actualWorkDone: z.coerce.number().int().nonnegative(),
  workDone: z.coerce.number().int().min(0).max(100),
  workDoneOnTime: z.coerce.number().int().min(0).max(100),
  totalWorkDone: z.coerce.number().int().min(0).max(100),
  weekPending: z.coerce.number().int().nonnegative(),
});

export type CreateMisReportEntryInput = z.infer<typeof createMisReportEntrySchema>;
