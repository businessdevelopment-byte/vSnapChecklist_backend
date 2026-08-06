import { z } from "zod";

/** Shared by any schema that takes a startDate/endDate pair a mutation will act on. */
export function checkDateRange(startDate: string, endDate: string, ctx: z.RefinementCtx, maxDays = 90) {
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000;
  if (days < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate must be on or after startDate" });
  } else if (days > maxDays) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: `Date range cannot exceed ${maxDays} days` });
  }
}

export const checklistQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
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

export const leaveSchema = z
  .object({
    userId: z.number().int().positive(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => checkDateRange(data.startDate, data.endDate, ctx));

export const checklistStatsQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

export const previewQuerySchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
    userId: z.coerce.number().int().positive().optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    search: z.string().optional(),
  })
  .superRefine((data, ctx) => checkDateRange(data.startDate, data.endDate, ctx));

export const transferredInQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(), // admin: filter by user
});

export const leaveLogsQuerySchema = z.object({
  userId: z.coerce.number().int().positive().optional(), // admin: filter by user; omitted + admin = everyone's
});

export type ChecklistQueryInput = z.infer<typeof checklistQuerySchema>;
export type SubmitChecklistInput = z.infer<typeof submitChecklistSchema>;
export type AdminDoneInput = z.infer<typeof adminDoneSchema>;
export type LeaveInput = z.infer<typeof leaveSchema>;
export type ChecklistStatsQueryInput = z.infer<typeof checklistStatsQuerySchema>;
export type PreviewQueryInput = z.infer<typeof previewQuerySchema>;
export type TransferredInQueryInput = z.infer<typeof transferredInQuerySchema>;
export type LeaveLogsQueryInput = z.infer<typeof leaveLogsQuerySchema>;
