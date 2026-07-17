import { z } from 'zod'

// Query filters for getting tasks
export const getMisChecklistSchema = z.object({
  dueDate: z.string().date().optional(),
  section: z.string().optional(),
  status: z.enum(['pending', 'completed', 'overdue']).optional(),
  userId: z.coerce.number().optional(),
  search: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20)
})

export type GetMisChecklistDTO = z.infer<typeof getMisChecklistSchema>

// Stats endpoint filters
export const getMisChecklistStatsSchema = z.object({
  dueDate: z.string().date().optional(),
  section: z.string().optional(),
  userId: z.coerce.number().optional()
})

export type GetMisChecklistStatsDTO = z.infer<typeof getMisChecklistStatsSchema>

// Complete task request
export const completeTaskSchema = z.object({
  remarks: z.string().optional()
})

export type CompleteTaskDTO = z.infer<typeof completeTaskSchema>
