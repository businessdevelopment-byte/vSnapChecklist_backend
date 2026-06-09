import { z } from "zod";

export const createTemplateSchema = z.object({
  taskCode: z.string().min(1).max(50),
  departmentId: z.number().int().positive(),
  givenBy: z.string().min(1).max(100),
  assignedUserId: z.number().int().positive(),
  description: z.string().min(1),
  startDate: z.string().date(), // ISO date "YYYY-MM-DD"
  lastDate: z.string().date().optional(),
  frequency: z.enum([
    "DAILY",
    "ALTERNATE_DAY",
    "WEEKLY",
    "FORTNIGHTLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
    "END_OF_1ST_WEEK",
    "END_OF_2ND_WEEK",
    "END_OF_3RD_WEEK",
    "END_OF_4TH_WEEK",
    "END_OF_LAST_WEEK",
  ]),
  enableReminders: z.boolean().default(true),
  requireAttachment: z.boolean().default(false),
});

export const updateTemplateSchema = createTemplateSchema
  .omit({ taskCode: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const templateQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(2000).default(50),
  departmentId: z.coerce.number().int().positive().optional(),
  assignedUserId: z.coerce.number().int().positive().optional(),
  frequency: z.enum([
    "DAILY", "ALTERNATE_DAY", "WEEKLY", "FORTNIGHTLY", "MONTHLY",
    "QUARTERLY", "YEARLY", "END_OF_1ST_WEEK", "END_OF_2ND_WEEK",
    "END_OF_3RD_WEEK", "END_OF_4TH_WEEK", "END_OF_LAST_WEEK",
  ]).optional(),
  isActive: z.string().transform(v => v === "true" || v === "1").optional(),
  search: z.string().optional(),
  sortBy: z.enum(["taskCode", "department", "givenBy", "assignedUser", "frequency", "startDate"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const importTemplatesSchema = z.array(
  z.object({
    taskCode: z.string().min(1).max(50),
    departmentName: z.string().min(1),
    givenBy: z.string().min(1).max(100),
    assignedUsername: z.string().min(1),
    description: z.string().min(1),
    startDate: z.string().date(),
    lastDate: z.string().date().optional(),
    frequency: z.enum([
      "DAILY", "ALTERNATE_DAY", "WEEKLY", "FORTNIGHTLY", "MONTHLY",
      "QUARTERLY", "YEARLY", "END_OF_1ST_WEEK", "END_OF_2ND_WEEK",
      "END_OF_3RD_WEEK", "END_OF_4TH_WEEK", "END_OF_LAST_WEEK",
    ]),
    enableReminders: z.boolean().optional(),
    requireAttachment: z.boolean().optional(),
  })
).min(1).max(2000);

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type TemplateQueryInput = z.infer<typeof templateQuerySchema>;
export type ImportTemplatesInput = z.infer<typeof importTemplatesSchema>;
