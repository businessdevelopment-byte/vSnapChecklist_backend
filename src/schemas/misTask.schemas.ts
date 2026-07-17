import { z } from "zod";

// Status/priority values preserve Master's exact business terminology —
// lowercase strings read from the "Tasks" sheet (TodayTasks.jsx:32,
// PendingTasks.jsx:31-33).
export const misTaskStatusSchema = z.enum(["pending", "in-progress", "completed"]);
export const misTaskPrioritySchema = z.enum(["high", "medium", "low"]);

export const misTaskQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
  status: misTaskStatusSchema.optional(),
  personName: z.string().optional(),
});

export type MisTaskQueryInput = z.infer<typeof misTaskQuerySchema>;

export const createMisTaskSchema = z.object({
  fmsName: z.string().optional(),
  taskName: z.string().min(1, "Task name is required"),
  personName: z.string().min(1, "Person name is required"),
  description: z.string().optional(),
  section: z.string().optional(),
  dueDate: z.string().optional(),
  status: misTaskStatusSchema.default("pending"),
  priority: misTaskPrioritySchema.default("medium"),
  todayTask: z.string().optional(),
  assignedUserId: z.number().int().positive("Assigned user ID is required"),
});

export type CreateMisTaskInput = z.infer<typeof createMisTaskSchema>;

export const updateMisTaskSchema = createMisTaskSchema.partial();

export type UpdateMisTaskInput = z.infer<typeof updateMisTaskSchema>;
