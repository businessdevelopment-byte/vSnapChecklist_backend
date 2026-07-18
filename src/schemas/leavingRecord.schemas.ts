import { z } from "zod";

export const leavingRecordQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type LeavingRecordQueryInput = z.infer<typeof leavingRecordQuerySchema>;

export const createLeavingRecordSchema = z.object({
  employeeId: z.coerce.number().int().positive("Employee is required"),
  dateOfLeaving: z.string().min(1, "Date of leaving is required"),
  mobileNumber: z.string().optional(),
  reasonOfLeaving: z.string().min(1, "Reason of leaving is required"),
});

export type CreateLeavingRecordInput = z.infer<typeof createLeavingRecordSchema>;
