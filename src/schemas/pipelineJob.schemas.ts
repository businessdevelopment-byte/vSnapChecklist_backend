import { z } from "zod";

export const pipelineJobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type PipelineJobQueryInput = z.infer<typeof pipelineJobQuerySchema>;

export const createPmsJobSchema = z.object({
  client: z.string().min(1, "Client is required"),
  jobGenre: z.string().optional(),
  customIdName: z.string().optional(),
  customId: z.string().optional(),
  salesExecutive: z.string().optional(),
  jobDate: z.string().optional(),
  deliveryDate: z.string().optional(),
  jobTime: z.string().optional(),
  pocName: z.string().optional(),
  pocContact: z.string().optional(),
  pocWhatsapp: z.string().optional(),
  pocEmail: z.string().optional(),
  poc2ndEmail: z.string().optional(),
  jobCity: z.string().optional(),
  jobShootAddress: z.string().optional(),
  jobSpecification: z.string().optional(),
  deliverables: z.string().optional(),
});

export type CreatePmsJobInput = z.infer<typeof createPmsJobSchema>;

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
