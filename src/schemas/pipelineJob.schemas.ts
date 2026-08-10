import { z } from "zod";

export const pipelineJobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type PipelineJobQueryInput = z.infer<typeof pipelineJobQuerySchema>;

// Job Cards are created against an existing Project Order (see
// PoliticalProjectOrder model). The 5 batch-level fields below are the
// card's real content, filled in up front; `topics` is now a legacy,
// optional escape hatch (empty by default) — when omitted, exactly one bare
// Job Card is created with `ideaDetails` left blank, fillable later via the
// existing Job Card Planning form + advanceStage() flow, same as
// plannedDate/contentType/editorName already were before this batch-fields
// addition. When topics ARE given, one Job Card is created per topic
// instead (up to 2), each getting the same batch-level fields.
export const createJobCardsBatchSchema = z.object({
  politicalProjectOrderId: z.number().int().positive("Project Order is required"),
  topics: z.array(z.string().trim().min(1)).max(2).default([]),
  plannedDate: z.string().date().optional(),
  contentType: z.enum(["Influencer", "Inhouse/Non-Face"]).optional(),
  voiceover: z.enum(["Yes", "No"]).optional(),
  editorName: z.string().trim().optional(),
  projectCoordinatorName: z.string().trim().optional(),
});

export type CreateJobCardsBatchInput = z.infer<typeof createJobCardsBatchSchema>;
