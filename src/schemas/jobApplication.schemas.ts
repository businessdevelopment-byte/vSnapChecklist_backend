import { z } from "zod";
import { JobApplicationSource } from "@prisma/client";

const phoneRegex = /^\d{10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const aadharRegex = /^\d{12}$/;

export const createJobApplicationSchema = z.object({
  vacancyId: z.number().int().positive("Vacancy is required"),
  source: z.enum([JobApplicationSource.INTERNAL, JobApplicationSource.EXTERNAL]).default(JobApplicationSource.EXTERNAL),
  candidateName: z.string().min(1, "Candidate name is required"),
  candidateDob: z.coerce.date().optional().nullable(),
  candidatePhone: z.string().regex(phoneRegex, "Phone must be 10 digits"),
  candidateEmail: z.string().regex(emailRegex, "Invalid email").optional().nullable(),
  maritalStatus: z.string().optional().nullable(),
  presentAddress: z.string().optional().nullable(),
  aadharNo: z.string().regex(aadharRegex, "Aadhar must be 12 digits").optional().nullable(),
  previousCompany: z.string().optional().nullable(),
  previousCompanyNoticePeriod: z.string().optional().nullable(),
  jobExperience: z.string().optional().nullable(),
  lastSalary: z.coerce.number().optional().nullable(),
  previousPosition: z.string().optional().nullable(),
  reasonForLeaving: z.string().optional().nullable(),
  lastEmployerMobile: z.string().optional().nullable(),
  referenceBy: z.string().optional().nullable(),
  candidatePhoto: z.string().optional().nullable(),
  candidateResume: z.string().optional().nullable(),
  salarySlip: z.string().optional().nullable(),
  experienceLetter: z.string().optional().nullable(),
  relievingLetter: z.string().optional().nullable(),
  remarks: z.string().optional().nullable(),
});

export const listJobApplicationSchema = z.object({
  search: z.string().optional(),
  vacancyId: z.coerce.number().int().optional(),
  source: z.string().optional(),
  stage: z.string().optional(),
});

export type CreateJobApplicationInput = z.infer<typeof createJobApplicationSchema>;
export type ListJobApplicationInput = z.infer<typeof listJobApplicationSchema>;
