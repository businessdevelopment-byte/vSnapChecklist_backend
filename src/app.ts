import express from "express";
import path from "path";

// BigInt is not JSON-serializable by default; serialize as string so res.json() works
// (Frontend ChecklistEntry.id is typed as string, so this is safe)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import routes from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";
import { sendError } from "./utils/apiResponse";

const app = express();
// Behind IIS reverse proxy on the same host: trust X-Forwarded-* only from loopback
app.set("trust proxy", "loopback");

// Systems locked here are disabled for everyone, no exceptions — mirrors
// LOCKED_SYSTEM_KEYS in frontend/src/lib/lockedSystems.ts. Frontend hiding
// alone isn't real protection, so the underlying API routes are blocked too.
// Keep this list in sync with the frontend's when a system is locked/unlocked.
const LOCKED_API_PATH_PREFIXES = [
  "/api/employees",
  "/api/hr-departments",
  "/api/designations",
  "/api/vacancies",
  "/api/job-applications",
  "/api/indents",
  "/api/enquiries",
  "/api/follow-ups",
  "/api/onboarding",
  "/api/leaving",
  "/api/offboarding",
  "/api/leave-requests",
  "/api/attendance",
  "/api/payroll",
  "/api/hr-dashboard",
  "/api/company-calendar",
];

const allowedOrigins = env.CORS_ORIGINS.split(",").map((origin) => origin.trim());
console.log("[CORS] Allowed origins:", allowedOrigins);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(compression());
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV, allowedOrigins });
});

// Serve uploaded files — set cross-origin header so images load when embedded.
// The CORS middleware above also answers here, which hls.js needs: it fetches
// video playlists/segments with XHR from the frontend's origin.
const uploadDirBase = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
// A video still being uploaded is never served half-written.
const UNFINISHED_VIDEO_FILE = /^\/videos\/[^/]+\/original\.part$/;
// Everything under videos/<id>/ is written once and never changed (VOD).
const VIDEO_FILE = /[\\/]videos[\\/][^\\/]+[\\/]/;
app.use("/uploads", (req, res, next) => {
  if (UNFINISHED_VIDEO_FILE.test(req.path)) {
    res.status(404).end();
    return;
  }
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(uploadDirBase, {
  setHeaders: (res, filePath) => {
    if (VIDEO_FILE.test(filePath)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  },
}));

app.use((req, res, next) => {
  if (LOCKED_API_PATH_PREFIXES.some((prefix) => req.originalUrl.startsWith(prefix))) {
    sendError(res, "This feature is currently unavailable", 404);
    return;
  }
  next();
});

app.use("/api", routes);

app.use(errorHandler);

export default app;
