import { z } from "zod";

export const pipelineJobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type PipelineJobQueryInput = z.infer<typeof pipelineJobQuerySchema>;

export const createPoliticalJobSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  projectId: z.string().optional(),
  type: z.string().optional(),
  voiceover: z.string().optional(),
  ideaDetails: z.string().optional(),
  attachmentLink: z.string().optional(),
  editorName: z.string().optional(),
  voiceoverPersonName: z.string().optional(),
  projectCoordinatorName: z.string().optional(),
  pcEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
});

export type CreatePoliticalJobInput = z.infer<typeof createPoliticalJobSchema>;
