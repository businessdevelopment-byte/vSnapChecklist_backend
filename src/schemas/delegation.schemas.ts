import { z } from "zod";

export const createDelegationSchema = z.object({
  taskCode: z.string().min(1).max(50),
  departmentId: z.number().int().positive(),
  givenBy: z.string().min(1).max(100),
  assignedUserId: z.number().int().positive(),
  description: z.string().min(1),
  taskStartDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid start date/time"),
  taskEndDate: z.string().refine((v) => !isNaN(Date.parse(v)), "Invalid end date/time").optional().nullable(),
  frequency: z.enum(["ONE_TIME", "CRITICAL", "URGENT"]),
  enableReminders: z.boolean().default(true),
  requireAttachment: z.boolean().default(false),
});

export const updateDelegationStatusSchema = z.object({
  status: z.enum(["PENDING", "PLANNED", "VERIFY_PENDING", "DONE"]),
});

export const submitDelegationSchema = z.object({
  status: z.enum(["DONE", "EXTEND_DATE"]),
  nextTargetDate: z.string().date().optional(),
  remarks: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const adminDoneDelegationSchema = z.object({
  historyIds: z.array(z.number().int().positive()).min(1),
});

export const delegationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
  userId: z.coerce.number().int().positive().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  status: z.enum(["PENDING", "PLANNED", "VERIFY_PENDING", "DONE"]).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  search: z.string().optional(),
  nameFilter: z.string().optional(),
});

export const delegationHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
  userId: z.coerce.number().int().positive().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  search: z.string().optional(),
});

export type CreateDelegationInput = z.infer<typeof createDelegationSchema>;
export type SubmitDelegationInput = z.infer<typeof submitDelegationSchema>;
export type DelegationQueryInput = z.infer<typeof delegationQuerySchema>;
export type DelegationHistoryQueryInput = z.infer<typeof delegationHistoryQuerySchema>;
