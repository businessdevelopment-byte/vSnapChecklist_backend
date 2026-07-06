import { z } from "zod";

export const offboardingChecklistQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type OffboardingChecklistQueryInput = z.infer<typeof offboardingChecklistQuerySchema>;

export const createOffboardingChecklistSchema = z.object({
  leavingRecordId: z.coerce.number().int().positive("Leaving record is required"),
  resignationLetterReceived: z.boolean().default(false),
  resignationAcceptance: z.boolean().default(false),
  handoverOfAssets: z.boolean().default(false),
  idCard: z.boolean().default(false),
  visitingCard: z.boolean().default(false),
  cancellationOfEmailId: z.boolean().default(false),
  biometricAccess: z.boolean().default(false),
  removeBenefitEnrollment: z.boolean().default(false),
  finalReleaseDate: z.string().optional(),
});

export type CreateOffboardingChecklistInput = z.infer<typeof createOffboardingChecklistSchema>;
