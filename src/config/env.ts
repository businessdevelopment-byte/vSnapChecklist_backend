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

  // Nightly Checklist & Delegation → Google Sheet mirror (services/sheetSync).
  // Off unless both the Apps Script web-app URL and its secret are set; the
  // script (scripts/sheet-sync/Code.gs) lives in the target sheet.
  SHEET_SYNC_URL: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().url().startsWith("https://script.google.com/", "SHEET_SYNC_URL must be a script.google.com web-app URL").optional()
  ),
  SHEET_SYNC_SECRET: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().min(32, "SHEET_SYNC_SECRET must be at least 32 characters").optional()
  ),
  // Lets a configured dev machine stay quiet so only production writes the sheet.
  SHEET_SYNC_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Daily run time, 24-hour HH:mm in India time (IST).
  SHEET_SYNC_TIME: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "SHEET_SYNC_TIME must be HH:mm (24-hour)").default("23:45"),
  // Only used for the "Open sheet" link in Settings.
  SHEET_SYNC_SPREADSHEET_ID: z.string().min(1).default("1pwd6iLpSQ0nncoc99vZCjo9WWgHcWWWmhNG5xQ5uajI"),
  SHEET_SYNC_CHECKLIST_TAB: z.string().min(1).default("Checklist"),
  SHEET_SYNC_DELEGATION_TAB: z.string().min(1).default("Delegation"),

  // Where uploads are written and served from (/uploads). Defaults to
  // <cwd>/uploads. Videos go under its videos/ subfolder.
  UPLOAD_DIR: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().optional()
  ),
  // Reference videos on Assign Task (services/video): caps for one video.
  VIDEO_MAX_MB: z.coerce.number().int().positive().default(500),
  VIDEO_MAX_DURATION_SEC: z.coerce.number().int().positive().default(900),
  // Explicit ffmpeg/ffprobe binaries. Unset → the ones bundled by the
  // ffmpeg-static/ffprobe-static packages, else whatever is on PATH.
  FFMPEG_PATH: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().optional()
  ),
  FFPROBE_PATH: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().optional()
  ),
  // false → uploaded videos are kept and played as-is (no quality ladder).
  VIDEO_TRANSCODE_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  // Capacity for many people submitting at once. Defaults suit a single
  // Windows server; raise them only with the CPU and disk to match.
  // Uploads one user may have in flight (a bulk submit of several tasks).
  VIDEO_MAX_ACTIVE_UPLOADS_PER_USER: z.coerce.number().int().positive().default(10),
  // Uploads in flight across all users, before new ones get 429.
  VIDEO_MAX_ACTIVE_UPLOADS_TOTAL: z.coerce.number().int().positive().default(60),
  // Chunk bodies held in memory at once (~5 MB each); the rest get 503 and retry.
  VIDEO_MAX_CONCURRENT_CHUNKS: z.coerce.number().int().positive().default(12),
  // Videos converted in parallel. Each ffmpeg gets its share of the CPU threads.
  VIDEO_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
  // ffprobe processes running at once when uploads are being finished.
  VIDEO_MAX_CONCURRENT_PROBES: z.coerce.number().int().positive().default(4),
  // Refuse new uploads when free space on the uploads drive would drop below this.
  VIDEO_MIN_FREE_DISK_GB: z.coerce.number().positive().default(5),
  // Postgres connections for this process (interactive transactions hold one).
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
