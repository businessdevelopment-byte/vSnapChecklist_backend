import { z } from "zod";

export const dailyAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type DailyAttendanceQueryInput = z.infer<typeof dailyAttendanceQuerySchema>;

export const createDailyAttendanceSchema = z.object({
  employeeId: z.coerce.number().int().positive("Employee is required"),
  year: z.coerce.number().int().positive("Year is required"),
  month: z.string().min(1, "Month is required"),
  date: z.string().min(1, "Date is required"),
  day: z.string().min(1, "Day is required"),
  holiday: z.enum(["Yes", "No"]).default("No"),
  workingDay: z.enum(["Yes", "No"]).default("Yes"),
  nHoliday: z.enum(["Yes", "No"]).default("No"),
  status: z.enum(["Present", "Absent", "Late"]).default("Present"),
  inTime: z.string().optional(),
  outTime: z.string().optional(),
  workingHours: z.string().default("0:00"),
  lateMinutes: z.coerce.number().int().nonnegative().default(0),
  earlyOut: z.coerce.number().int().nonnegative().default(0),
  overtimeHours: z.string().default("0:00"),
  punchMiss: z.enum(["Yes", "No"]).default("No"),
  remarks: z.string().optional(),
});

export type CreateDailyAttendanceInput = z.infer<typeof createDailyAttendanceSchema>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const myAttendanceQuerySchema = z.object({
  month: z.enum(MONTHS),
  year: z.coerce.number().int().positive(),
});

export type MyAttendanceQueryInput = z.infer<typeof myAttendanceQuerySchema>;
