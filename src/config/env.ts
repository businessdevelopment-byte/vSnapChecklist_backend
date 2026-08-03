import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid PostgreSQL URL"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  // Shared parent domain (e.g. ".vsnapu.com") for the refreshToken/accessToken
  // cookies — set this when the frontend and backend live on different
  // subdomains of the same site, so the browser attaches the cookie to both.
  // Leave unset for local dev (host-only cookie, matches localhost same-origin setup).
COOKIE_DOMAIN: z.string().optional(),
  VSNAPU_JOB_MASTER_BASE_URL: z.string().url().default("https://apis.vsnapu.com"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
