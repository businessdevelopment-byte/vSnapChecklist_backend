import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().min(2).max(50).regex(/^\S+$/, "No spaces allowed"),
  password: z.string().min(4).max(100),
  role: z.enum(["ADMIN", "USER"]).default("USER"),
  email: z.string().email().optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
});

export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["ADMIN", "USER"]),
});

export const updateUserDeptSchema = z.object({
  departmentId: z.number().int().positive().nullable(),
});

export const updateMyProfileSchema = z.object({
  email: z.string().email("Invalid email").optional().nullable(),
  departmentId: z.number().int().positive().optional().nullable(),
});

export const importUsersSchema = z.array(
  z.object({
    username: z.string().min(2).max(50),
    password: z.string().min(4),
    role: z.enum(["ADMIN", "USER"]).default("USER"),
    email: z.string().email().optional().nullable(),
    departmentId: z.number().int().positive().optional().nullable(),
  })
).min(1).max(200);

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ImportUsersInput = z.infer<typeof importUsersSchema>;
