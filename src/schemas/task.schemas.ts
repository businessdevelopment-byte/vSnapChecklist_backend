import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  taskType: z
    .enum(["CHECKLIST", "QUICK_TASK", "DELEGATION"])
    .default("CHECKLIST"),
  dueDate: z.string().datetime().optional(),
  assignedToId: z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z
    .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "APPROVED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: z.string().datetime().optional(),
  assignedToId: z.number().int().positive().optional(),
  remarks: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

export const taskQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum(["PENDING", "IN_PROGRESS", "COMPLETED", "OVERDUE", "APPROVED"])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  taskType: z
    .enum(["CHECKLIST", "QUICK_TASK", "DELEGATION"])
    .optional(),
  assignedToId: z.coerce.number().int().positive().optional(),
  date: z.string().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
