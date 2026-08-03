import { z } from "zod";

export const pipelineJobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type PipelineJobQueryInput = z.infer<typeof pipelineJobQuerySchema>;

export const createPoliticalJobSchema = z.object({
  projectName: z.string().min(1, "Required"),
  reportingPersonName: z.string().optional(),
  reportingPersonWhatsapp: z.string().optional(),
  reportingGroupName: z.string().optional(),
  instagramPages: z.string().optional(),
  currentFollowers: z.string().optional(),
  openingViews: z.string().optional(),
  monthlyViewsTarget: z.string().optional(),
  remarks: z.string().optional(),
});

export type CreatePoliticalJobInput = z.infer<typeof createPoliticalJobSchema>;
