import { z } from "zod";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const leaveRequestQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive("Employee is required"),
  month: z.enum(MONTHS).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export type LeaveRequestQueryInput = z.infer<typeof leaveRequestQuerySchema>;

export const leaveBalanceQuerySchema = z.object({
  employeeId: z.coerce.number().int().positive("Employee is required"),
});

export type LeaveBalanceQueryInput = z.infer<typeof leaveBalanceQuerySchema>;

export const leaveTypeEnum = z.enum(["Casual Leave", "Sick Leave", "Earned Leave"]);

export const createLeaveRequestSchema = z.object({
  employeeId: z.coerce.number().int().positive("Employee is required"),
  leaveType: leaveTypeEnum.default("Casual Leave"),
  fromDate: z.string().min(1, "From date is required"),
  toDate: z.string().min(1, "To date is required"),
  reason: z.string().min(1, "Reason is required"),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const leaveStatusEnum = z.enum(["Pending", "Approved", "Rejected"]);

export const leaveManagementQuerySchema = z.object({
  status: leaveStatusEnum.default("Pending"),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
});

export type LeaveManagementQueryInput = z.infer<typeof leaveManagementQuerySchema>;

export const updateLeaveRequestStatusSchema = z.object({
  status: z.enum(["Approved", "Rejected"]),
});

export type UpdateLeaveRequestStatusInput = z.infer<typeof updateLeaveRequestStatusSchema>;
