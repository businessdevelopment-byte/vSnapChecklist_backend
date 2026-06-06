import { z } from "zod";

export const checklistQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
  date: z.string().date().optional(), // specific date (default: today)
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  userId: z.coerce.number().int().positive().optional(), // admin: filter by user
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(["pending", "completed", "overdue", "leave", "admin_done"]).optional(),
  search: z.string().optional(),
});

export const submitChecklistSchema = z.object({
  completionStatus: z.enum(["YES", "NO", "NOT_REQUIRED", "NOT_APPLICABLE"]),
  remarks: z.string().optional(),
  uploadedImageUrl: z.string().optional(),
  remarks1: z.string().optional(),
});

export const adminDoneSchema = z.object({
  entryIds: z.array(z.coerce.bigint().positive()).min(1),
});

export const leaveSchema = z.object({
  userId: z.number().int().positive(),
  startDate: z.string().date(),
  endDate: z.string().date(),
});

export const checklistStatsQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

export type ChecklistQueryInput = z.infer<typeof checklistQuerySchema>;
export type SubmitChecklistInput = z.infer<typeof submitChecklistSchema>;
export type AdminDoneInput = z.infer<typeof adminDoneSchema>;
export type LeaveInput = z.infer<typeof leaveSchema>;
export type ChecklistStatsQueryInput = z.infer<typeof checklistStatsQuerySchema>;
