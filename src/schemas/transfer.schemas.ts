import { z } from "zod";
import { checkDateRange } from "./checklist.schemas";

export const transferTasksSchema = z
  .object({
    toUserId: z.number().int().positive(),
    reason: z.string().optional(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    fromUserId: z.number().int().positive(),
    transferTemplate: z.boolean().default(false), // also update the template so future entries go to new user
    taskCodes: z.array(z.string()).optional(), // checklist task codes; if empty, transfer ALL checklist tasks in range
    delegationTaskCodes: z.array(z.string()).optional(), // delegation task codes; if empty, transfer ALL delegation tasks in range
  })
  .superRefine((data, ctx) => checkDateRange(data.startDate, data.endDate, ctx));

export const reviewRequestSchema = z.object({
  reviewNote: z.string().optional(),
});

export type TransferTasksInput = z.infer<typeof transferTasksSchema>;
export type ReviewRequestInput = z.infer<typeof reviewRequestSchema>;
