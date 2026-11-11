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
  // Legacy MIS Google Sheet ("New Mis Summary V.01") and its "For Records"
  // tab, read-only via the sheet's public link (misSheet.service.ts).
  MIS_SHEET_ID: z.string().min(1).default("1H8mSp4YEUxKQC7dIKTj0hNcpIWf1gpLJh2BIt2WhGiQ"),
  MIS_SHEET_FOR_RECORDS_GID: z.string().regex(/^\d+$/, "MIS_SHEET_FOR_RECORDS_GID must be the tab's numeric gid").default("39144063"),
  // The MIS sheet's Apps Script web app (".../macros/s/<id>/exec"), the same
  // one the old MIS app reads with ?sheet=. Preferred source when set; the
  // public CSV export is the fallback. Not defaulted: anyone with this URL
  // can read every tab, so it lives only in .env.
  MIS_APPS_SCRIPT_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().startsWith("https://script.google.com/", "MIS_APPS_SCRIPT_URL must be a script.google.com web-app URL").optional()
  ),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
