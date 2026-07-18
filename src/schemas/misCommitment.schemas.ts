import { z } from "zod";

export const misCommitmentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
  name: z.string().optional(),
  dateStart: z.string().optional(),
});

export type MisCommitmentQueryInput = z.infer<typeof misCommitmentQuerySchema>;

export const submitMisCommitmentsSchema = z.object({
  items: z
    .array(
      z.object({
        recordId: z.coerce.number().int().positive(),
        nextWeekPlannedNotDone: z.coerce.number().int().min(0).max(100).optional(),
        nextWeekPlannedNotDoneOnTime: z.coerce.number().int().min(0).max(100).optional(),
        nextWeekCommitment: z.string().optional(),
      })
    )
    .min(1, "Select at least one person"),
});

export type SubmitMisCommitmentsInput = z.infer<typeof submitMisCommitmentsSchema>;
