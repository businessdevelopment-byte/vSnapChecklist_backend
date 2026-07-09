import { z } from "zod";

export const otpJobQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
  jobGenre: z.string().optional(),
  salesExecutive: z.string().optional(),
  jobCity: z.string().optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
});

export const createOtpJobSchema = z.object({
  client: z.string().min(1, "Client is required"),
  jobGenre: z.string().min(1, "Job genre is required"),
  customIdName: z.string().optional(),
  customId: z.string().optional(),
  salesExecutive: z.string().min(1, "Sales executive is required"),
  jobDate: z.string().date(),
  deliveryDate: z.string().date(),
  jobTime: z.string().min(1, "Job time is required"),
  pocName: z.string().min(1, "POC name is required"),
  pocContact: z.string().min(1, "POC contact is required"),
  pocWhatsapp: z.string().optional(),
  pocEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  poc2ndEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  jobCity: z.string().min(1, "Job city is required"),
  jobShootAddress: z.string().min(1, "Job shoot address is required"),
  jobSpecification: z.string().optional(),
  deliverables: z.string().optional(),
  packageAmount: z.coerce.number().nonnegative(),
  operationsCost: z.coerce.number().nonnegative(),
  taxableAmount: z.coerce.number().nonnegative(),
  isTokenReceived: z.boolean().default(false),
});

export const externalJobDateRangeSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
});

// Shape of one job as returned by the external vsnapu Job Master API
// (GET https://apis.vsnapu.com/api/JobMaster/GetJobsCreatedBetween) — a system
// we don't control, so this is validated at the boundary rather than trusted.
export const externalOtpJobSchema = z.object({
  jobId: z.string().min(1),
  projectId: z.string().min(1),
  // Not min(1) — real historical records can have these blank; they map to
  // NOT NULL (but non-identity) Prisma columns, so empty string is fine.
  clientName: z.string(),
  jobGenre: z.string(),
  customIdName: z.string().nullish(),
  customId: z.string().nullish(),
  salesExecutive: z.string(),
  jobDate: z.string().min(1),
  // Frequently absent at job-creation time in the source system (not an
  // edge case — ~62% null in a sampled range).
  deliveryDate: z.string().nullish(),
  jobTime: z.string(),
  pocName: z.string(),
  pocContact: z.string(),
  pocWhatsApp: z.string().nullish(),
  pocEmail: z.string().nullish(),
  poc2ndEmail: z.string().nullish(),
  jobCity: z.string(),
  jobShootAddress: z.string().nullish(),
  jobSpecifications: z.string().nullish(),
  deliverables: z.string().nullish(),
  packageAmount: z.coerce.number(),
  operationsCostNonTaxableAmount: z.coerce.number(),
  taxableAmount: z.coerce.number(),
  gst: z.coerce.number(),
  packageAmountWithTax: z.coerce.number(),
  isTokenReceived: z.string(),
});

export type OtpJobQueryInput = z.infer<typeof otpJobQuerySchema>;
export type CreateOtpJobInput = z.infer<typeof createOtpJobSchema>;
export type ExternalJobDateRangeInput = z.infer<typeof externalJobDateRangeSchema>;
export type ExternalOtpJob = z.infer<typeof externalOtpJobSchema>;
