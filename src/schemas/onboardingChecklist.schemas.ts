import { z } from "zod";

export const onboardingChecklistQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type OnboardingChecklistQueryInput = z.infer<typeof onboardingChecklistQuerySchema>;

export const createOnboardingChecklistSchema = z.object({
  employeeId: z.coerce.number().int().positive("Employee is required"),
  checkSalarySlipResume: z.boolean().default(false),
  offerLetterReceived: z.boolean().default(false),
  welcomeMeeting: z.boolean().default(false),
  biometricAccess: z.boolean().default(false),
  officialEmailId: z.boolean().default(false),
  assignAssets: z.boolean().default(false),
  pfEsic: z.boolean().default(false),
  companyDirectory: z.boolean().default(false),
});

export type CreateOnboardingChecklistInput = z.infer<typeof createOnboardingChecklistSchema>;
