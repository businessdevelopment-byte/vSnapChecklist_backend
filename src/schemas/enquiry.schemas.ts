import { z } from "zod";

export const enquiryQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type EnquiryQueryInput = z.infer<typeof enquiryQuerySchema>;

export const createEnquirySchema = z.object({
  indentId: z.coerce.number().int().positive("Indent is required"),
  candidateName: z.string().min(1, "Candidate name is required"),
  candidateDOB: z.string().optional(),
  candidatePhone: z.string().min(1, "Candidate phone is required"),
  candidateEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  previousCompany: z.string().optional(),
  jobExperience: z.string().optional(),
  previousPosition: z.string().optional(),
  maritalStatus: z.enum(["Single", "Married"]).default("Single"),
  presentAddress: z.string().optional(),
  aadharNo: z.string().optional(),
  status: z.enum(["Pending", "Shortlisted", "Selected", "Rejected"]).default("Pending"),
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;
