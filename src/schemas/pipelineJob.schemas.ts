import { z } from "zod";

export const pipelineJobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type PipelineJobQueryInput = z.infer<typeof pipelineJobQuerySchema>;

// Job Cards are created against an existing Project Order (see
// PoliticalProjectOrder model) via a "News Picking" intake — one submission
// picks 1-10 news topics, each becoming its own bare Job Card row (sitting
// Pending at JOB_CARD_PLANNING) with its topic pre-filled onto `ideaDetails`.
// The remaining planning fields (content type, planned date, editor) are
// still submitted per-card afterward via the existing, unchanged
// jobCardPlanningSchema + advanceStage() flow, not at creation time.
export const createJobCardsBatchSchema = z.object({
  politicalProjectOrderId: z.number().int().positive("Project Order is required"),
  topics: z.array(z.string().trim().min(1)).min(1, "At least one news topic is required").max(10),
});

export type CreateJobCardsBatchInput = z.infer<typeof createJobCardsBatchSchema>;
