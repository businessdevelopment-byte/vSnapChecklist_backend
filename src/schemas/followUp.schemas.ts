import { z } from "zod";

export const followUpQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type FollowUpQueryInput = z.infer<typeof followUpQuerySchema>;

export const createFollowUpSchema = z.object({
  enquiryId: z.coerce.number().int().positive("Enquiry is required"),
  status: z.enum(["Interested", "Not Interested", "Joined", "Call Back Later"]).default("Interested"),
  candidateSays: z.string().min(1, "Candidate says is required"),
  nextDate: z.string().optional(),
});

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
