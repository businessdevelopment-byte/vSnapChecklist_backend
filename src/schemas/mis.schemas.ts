import { z } from "zod";

export const misSystemKeyEnum = z.enum(["CHECKLIST_DELEGATION", "ORDER_TO_PAYMENT", "PMS", "POLITICAL", "HR"]);

export const misDashboardQuerySchema = z.object({
  systemKey: misSystemKeyEnum,
  weekStart: z.string().optional(),
  userId: z.coerce.number().int().positive().optional(),
});

export type MisDashboardQueryInput = z.infer<typeof misDashboardQuerySchema>;

export const misHistoryQuerySchema = z.object({
  systemKey: misSystemKeyEnum,
  userId: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(20),
});

export type MisHistoryQueryInput = z.infer<typeof misHistoryQuerySchema>;

export const setMisTargetSchema = z.object({
  userId: z.coerce.number().int().positive(),
  systemKey: misSystemKeyEnum,
  weekStart: z.string().min(1, "Week is required"),
  target: z.coerce.number().int().min(0, "Must be 0 or more"),
});

export type SetMisTargetInput = z.infer<typeof setMisTargetSchema>;

export const submitMisPlansSchema = z.object({
  items: z
    .array(
      z.object({
        userId: z.coerce.number().int().positive(),
        systemKey: misSystemKeyEnum,
        weekStart: z.string().min(1, "Week is required"),
        plannedNotDonePct: z.coerce.number().int().min(0).max(100).optional(),
        plannedNotDoneOnTimePct: z.coerce.number().int().min(0).max(100).optional(),
        commitment: z.string().max(1000).optional(),
      })
    )
    .min(1, "At least one item is required")
    .max(200),
});

export type SubmitMisPlansInput = z.infer<typeof submitMisPlansSchema>;
