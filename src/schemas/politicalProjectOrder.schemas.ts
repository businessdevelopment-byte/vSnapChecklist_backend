import { z } from "zod";

// Same field list/optionality as the old createPoliticalJobSchema
// (pipelineJob.schemas.ts) — Project Order is now its own standalone
// entity instead of a PipelineJob's first stage event.
export const createPoliticalProjectOrderSchema = z.object({
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

export type CreatePoliticalProjectOrderInput = z.infer<typeof createPoliticalProjectOrderSchema>;

export const politicalProjectOrderListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type PoliticalProjectOrderListQueryInput = z.infer<typeof politicalProjectOrderListQuerySchema>;
