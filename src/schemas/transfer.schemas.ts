import { z } from "zod";

export const transferTasksSchema = z.object({
  toUserId: z.number().int().positive(),
  reason: z.string().optional(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  fromUserId: z.number().int().positive(),
  transferTemplate: z.boolean().default(false), // also update the template so future entries go to new user
  taskCodes: z.array(z.string()).optional(), // if empty, transfer ALL tasks in range
});

export type TransferTasksInput = z.infer<typeof transferTasksSchema>;
