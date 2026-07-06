import { z } from "zod";

export const monthlyAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type MonthlyAttendanceQueryInput = z.infer<typeof monthlyAttendanceQuerySchema>;

export const createMonthlyAttendanceSchema = z.object({
  employeeId: z.coerce.number().int().positive("Employee is required"),
  year: z.coerce.number().int().positive("Year is required"),
  month: z.string().min(1, "Month is required"),
  punchDays: z.coerce.number().int().nonnegative().default(0),
  totalOnTime: z.coerce.number().int().nonnegative().default(0),
  lateDays: z.coerce.number().int().nonnegative().default(0),
  lateNotAllowed: z.coerce.number().int().nonnegative().default(0),
  lateAllowed: z.coerce.number().int().nonnegative().default(0),
  punchMiss: z.coerce.number().int().nonnegative().default(0),
  holidays: z.coerce.number().int().nonnegative().default(0),
  absents: z.coerce.number().int().nonnegative().default(0),
  totalWorking: z.coerce.number().int().nonnegative().default(0),
  mgmtAdjustment: z.coerce.number().int().default(0),
  grandTotalDays: z.coerce.number().int().nonnegative().default(0),
});

export type CreateMonthlyAttendanceInput = z.infer<typeof createMonthlyAttendanceSchema>;
