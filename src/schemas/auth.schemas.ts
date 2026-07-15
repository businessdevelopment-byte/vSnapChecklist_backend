import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(2, "At least 2 characters")
    .max(50, "Max 50 characters")
    .regex(/^\S+$/, "No spaces allowed"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
  email: z.string().email("Invalid email").optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
