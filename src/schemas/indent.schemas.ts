import { z } from "zod";

export const indentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(100),
  search: z.string().optional(),
});

export type IndentQueryInput = z.infer<typeof indentQuerySchema>;

export const createIndentSchema = z.object({
  post: z.string().min(1, "Post is required"),
  gender: z.enum(["Male", "Female", "Any"]).default("Male"),
  prefer: z.enum(["Fresher", "Experienced"]).default("Fresher"),
  noOfPost: z.coerce.number().int().positive("Must be at least 1"),
  completionDate: z.string().min(1, "Completion date is required"),
  socialSite: z.enum(["LinkedIn", "Naukri", "Indeed", "Shine", "Campus"]).default("LinkedIn"),
});

export type CreateIndentInput = z.infer<typeof createIndentSchema>;
