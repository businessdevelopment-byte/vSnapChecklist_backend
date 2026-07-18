import { z } from "zod";
import { HrGender, VacancyPriority } from "@prisma/client";

export const createVacancySchema = z.object({
  vacancyName: z.string().optional().nullable(),
  designationId: z.number().int().positive("Designation is required"),
  gender: z.enum([HrGender.MALE, HrGender.FEMALE, HrGender.ANY]),
  numberOfPosts: z.number().int().positive("Number of posts must be at least 1"),
  completionDate: z.coerce.date(),
  salaryCriteria: z.string().optional().nullable(),
  jobDescription: z.string().optional().nullable(),
  preferredQualification: z.string().optional().nullable(),
  preferredLocation: z.string().optional().nullable(),
  preferredExperience: z.string().optional().nullable(),
  experienceRequired: z.boolean().default(false),
  socialPlatforms: z.string().optional().nullable(),
  postingLinks: z.record(z.any()).optional().nullable(),
  priority: z.enum([VacancyPriority.LOW, VacancyPriority.MEDIUM, VacancyPriority.HIGH]).default(VacancyPriority.MEDIUM),
  remarks: z.string().optional().nullable(),
});

export const updateVacancySchema = createVacancySchema.partial();

export const vacancyApprovalSchema = z.object({
  approvalStatus: z.enum(["PENDING", "PENDING_HR", "APPROVED", "REJECTED"]),
  rejectionRemark: z.string().optional().nullable(),
});

export type CreateVacancyInput = z.infer<typeof createVacancySchema>;
export type UpdateVacancyInput = z.infer<typeof updateVacancySchema>;
export type VacancyApprovalInput = z.infer<typeof vacancyApprovalSchema>;
