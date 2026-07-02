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

export type OtpJobQueryInput = z.infer<typeof otpJobQuerySchema>;
export type CreateOtpJobInput = z.infer<typeof createOtpJobSchema>;
