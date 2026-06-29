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
import { env } from "./config/env";
import routes from "./routes/index";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

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
  })
);
app.use(compression());
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", env: env.NODE_ENV, allowedOrigins });
});

// Serve uploaded files — set cross-origin header so images load when embedded
const uploadDirBase = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));
app.use("/uploads", (_req, res, next) => {
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
}, express.static(uploadDirBase));

app.use("/api", routes);

app.use(errorHandler);

export default app;
