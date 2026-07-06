import { z } from "zod";

export const payrollQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
  month: z.string().optional(),
});

export type PayrollQueryInput = z.infer<typeof payrollQuerySchema>;

export const createPayrollEntrySchema = z.object({
  employeeId: z.coerce.number().int().positive("Employee is required"),
  year: z.string().min(1).default("2026"),
  month: z.string().min(1).default("June"),
  basicSalary: z.coerce.number().nonnegative("Basic salary is required"),
  lta: z.coerce.number().nonnegative().default(0),
  bonus: z.coerce.number().nonnegative().default(0),
  otherAllowances: z.coerce.number().nonnegative().default(0),
  overtime: z.coerce.number().nonnegative().default(0),
  pf: z.coerce.number().nonnegative().default(0),
  loan: z.coerce.number().nonnegative().default(0),
  otherDeductions: z.coerce.number().nonnegative().default(0),
  status: z.enum(["Pending", "Paid"]).default("Pending"),
  payDate: z.string().optional(),
});

export type CreatePayrollEntryInput = z.infer<typeof createPayrollEntrySchema>;

export const mySalaryQuerySchema = z.object({
  year: z.string().min(1),
});

export type MySalaryQueryInput = z.infer<typeof mySalaryQuerySchema>;
