import { z } from "zod";

export const misRecordQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
  designation: z.string().optional(),
});

export type MisRecordQueryInput = z.infer<typeof misRecordQuerySchema>;

export const createMisRecordSchema = z.object({
  name: z.string().min(1, "Name is required"),
  designation: z.string().optional(),
  phone: z.string().optional(),
  dateStart: z.string().min(1, "Start date is required"),
  dateEnd: z.string().min(1, "End date is required"),
  target: z.coerce.number().int().nonnegative(),
  actualWorkDone: z.coerce.number().int().nonnegative(),
  weeklyWorkDone: z.coerce.number().int().min(0).max(100),
  weeklyWorkDoneOnTime: z.coerce.number().int().min(0).max(100),
  totalWorkDone: z.coerce.number().int().nonnegative(),
  weekPending: z.coerce.number().int().nonnegative(),
  allPendingTillDate: z.coerce.number().int().nonnegative(),
  plannedWorkNotDone: z.coerce.number().int().min(0).max(100).default(0),
  plannedWorkNotDoneOnTime: z.coerce.number().int().min(0).max(100).default(0),
  commitment: z.string().optional(),
  assignedUserId: z.coerce.number().int().positive(),
});

export type CreateMisRecordInput = z.infer<typeof createMisRecordSchema>;

export const updateMisRecordSchema = createMisRecordSchema.partial();

export type UpdateMisRecordInput = z.infer<typeof updateMisRecordSchema>;
